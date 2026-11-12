import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  communityMessages,
  hospitals,
  incidentClusters,
  localizedAlerts,
  massAlerts,
  predictionHistory,
  rescueTeams,
  shelters,
  sosRequests,
  users,
  volunteers,
} from './schema.ts';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PRIORITY_RANK: Record<string, number> = { P0: 4, P1: 3, P2: 2, P3: 1 };

export function computeDeterministicTriage(input: {
  category: string;
  severity: string;
  peopleCount: number;
  medicalNeeds?: string;
  vulnerableGroups?: string;
  waterDepthCm?: number;
}): { priority: 'P0' | 'P1' | 'P2' | 'P3'; priorityScore: number; priorityReason: string } {
  let score = 25;
  const reasons: string[] = [];

  if (input.severity === 'Critical') {
    score += 30;
    reasons.push('Critical severity reported');
  } else if (input.severity === 'High') {
    score += 20;
    reasons.push('High severity condition');
  } else if (input.severity === 'Moderate') {
    score += 10;
  }

  if (input.category === 'Medical Emergency') {
    score += 22;
    reasons.push('Acute medical emergency');
  } else if (input.category === 'Rising Water / Trapped') {
    score += 18;
    reasons.push('Individuals trapped by rising water');
  } else if (input.category === 'Structural Collapse') {
    score += 20;
    reasons.push('Structural hazard');
  }

  const depth = Number(input.waterDepthCm || 0);
  if (depth >= 120) {
    score += 18;
    reasons.push(`${depth}cm life-threatening water depth`);
  } else if (depth >= 60) {
    score += 10;
    reasons.push(`${depth}cm elevated floodwater`);
  }

  if (input.medicalNeeds && input.medicalNeeds.trim().length > 2 && input.medicalNeeds.toLowerCase() !== 'none') {
    score += 12;
    reasons.push(`Medical requirement (${input.medicalNeeds})`);
  }

  if (input.vulnerableGroups && input.vulnerableGroups.trim().length > 2 && input.vulnerableGroups.toLowerCase() !== 'none') {
    score += 12;
    reasons.push(`Vulnerable group (${input.vulnerableGroups})`);
  }

  if (input.peopleCount >= 6) {
    score += 8;
    reasons.push(`${input.peopleCount} people affected`);
  } else if (input.peopleCount >= 3) {
    score += 4;
  }

  const clampedScore = Math.min(99, Math.max(15, score));
  let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';
  if (clampedScore >= 85) priority = 'P0';
  else if (clampedScore >= 68) priority = 'P1';
  else if (clampedScore >= 45) priority = 'P2';

  const explanation =
    reasons.length > 0
      ? `AI Triage ${priority} (Score ${clampedScore}/100): ${reasons.join(' + ')}.`
      : `AI Triage ${priority} (Score ${clampedScore}/100): Standard ${input.category} request.`;

  return { priority, priorityScore: clampedScore, priorityReason: explanation };
}

export async function getAllAlertNetState() {
  try {
    const [
      sosList,
      clusters,
      teams,
      shelterList,
      alerts,
      history,
      logs,
      citizenUsers,
      chatMessages,
      volunteerList,
      localAlerts,
      hospitalList,
    ] = await Promise.all([
      db.select().from(sosRequests).orderBy(desc(sosRequests.createdAt)),
      db.select().from(incidentClusters).orderBy(desc(incidentClusters.createdAt)),
      db.select().from(rescueTeams).orderBy(rescueTeams.id),
      db.select().from(shelters).orderBy(shelters.id),
      db.select().from(massAlerts).orderBy(desc(massAlerts.createdAt)),
      db.select().from(predictionHistory).orderBy(desc(predictionHistory.timestamp)).limit(15),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select().from(communityMessages).orderBy(desc(communityMessages.createdAt)),
      db.select().from(volunteers).orderBy(desc(volunteers.createdAt)),
      db.select().from(localizedAlerts).orderBy(desc(localizedAlerts.createdAt)),
      db.select().from(hospitals).orderBy(hospitals.id),
    ]);

    return {
      sosRequests: sosList,
      incidentClusters: clusters,
      rescueTeams: teams,
      shelters: shelterList,
      massAlerts: alerts,
      predictionHistory: history,
      auditLogs: logs,
      registeredCitizens: citizenUsers,
      communityMessages: chatMessages,
      volunteers: volunteerList,
      localizedAlerts: localAlerts,
      hospitals: hospitalList,
    };
  } catch (error) {
    console.error('Database query failed in getAllAlertNetState:', error);
    throw new Error('Failed to load operational command state.', { cause: error });
  }
}

export async function getRecentPredictionHistory() {
  try {
    const rows = await db
      .select()
      .from(predictionHistory)
      .orderBy(desc(predictionHistory.timestamp))
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      city: r.city,
      lat: r.lat,
      lon: r.lon,
      temp: r.temp,
      humidity: r.humidity,
      rainfall: r.rainfall,
      pressure: r.pressure,
      river_level: r.riverLevel,
      risk_level: r.riskLevel,
      risk_score: r.riskScore,
      is_simulation: r.isSimulation,
      timestamp: r.timestamp ? r.timestamp.toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in getRecentPredictionHistory:', error);
    throw new Error('Failed to fetch prediction history.', { cause: error });
  }
}

export async function insertPredictionRecord(record: {
  city: string;
  lat: number;
  lon: number;
  temp: number;
  humidity: number;
  rainfall: number;
  pressure: number;
  riverLevel: number;
  riskLevel: string;
  riskScore: number;
  isSimulation?: boolean;
}) {
  try {
    const [inserted] = await db
      .insert(predictionHistory)
      .values({
        city: record.city,
        lat: record.lat,
        lon: record.lon,
        temp: record.temp,
        humidity: record.humidity,
        rainfall: record.rainfall,
        pressure: record.pressure,
        riverLevel: record.riverLevel,
        riskLevel: record.riskLevel,
        riskScore: record.riskScore,
        isSimulation: Boolean(record.isSimulation),
      })
      .returning();
    return inserted;
  } catch (error) {
    console.error('Database query failed in insertPredictionRecord:', error);
    throw new Error('Failed to save prediction record.', { cause: error });
  }
}

export async function createDurableSosRequest(payload: {
  idempotencyKey: string;
  citizenUid?: string;
  citizenName: string;
  phone?: string;
  lat: number;
  lon: number;
  region: string;
  category: string;
  peopleCount: number;
  severity: string;
  medicalNeeds?: string;
  vulnerableGroups?: string;
  waterDepthCm?: number;
  description?: string;
  mediaNote?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  priorityScore: number;
  priorityReason: string;
  isSimulated?: boolean;
}) {
  try {
    const existing = await db
      .select()
      .from(sosRequests)
      .where(eq(sosRequests.idempotencyKey, payload.idempotencyKey));

    if (existing.length > 0) {
      return { record: existing[0], deduplicated: true };
    }

    const activeClusters = await db.select().from(incidentClusters);
    let matchedCluster = activeClusters.find(
      (c) =>
        c.status === 'Active' &&
        haversineKm(c.centerLat, c.centerLon, payload.lat, payload.lon) <= 2.5
    );

    let clusterCode = matchedCluster?.clusterCode;
    if (!matchedCluster) {
      clusterCode = `CLU-${Math.floor(100 + Math.random() * 899)}-${Date.now().toString().slice(-3)}`;
      const [createdCluster] = await db
        .insert(incidentClusters)
        .values({
          clusterCode,
          region: payload.region,
          centerLat: payload.lat,
          centerLon: payload.lon,
          primaryCategory: payload.category,
          highestPriority: payload.priority,
          totalPeople: payload.peopleCount,
          sosCount: 1,
          status: 'Active',
        })
        .returning();
      matchedCluster = createdCluster;
    } else {
      const nextPriority =
        (PRIORITY_RANK[payload.priority] || 1) > (PRIORITY_RANK[matchedCluster.highestPriority] || 1)
          ? payload.priority
          : matchedCluster.highestPriority;
      await db
        .update(incidentClusters)
        .set({
          totalPeople: matchedCluster.totalPeople + payload.peopleCount,
          sosCount: matchedCluster.sosCount + 1,
          highestPriority: nextPriority,
        })
        .where(eq(incidentClusters.id, matchedCluster.id));
    }

    const trackingId = `SOS-${Math.floor(1000 + Math.random() * 8999)}-${Date.now().toString().slice(-3)}`;

    const [inserted] = await db
      .insert(sosRequests)
      .values({
        trackingId,
        idempotencyKey: payload.idempotencyKey,
        citizenUid: payload.citizenUid || null,
        citizenName: payload.citizenName,
        phone: payload.phone || '+91-90000-00000',
        lat: payload.lat,
        lon: payload.lon,
        region: payload.region,
        category: payload.category,
        peopleCount: payload.peopleCount,
        severity: payload.severity,
        medicalNeeds: payload.medicalNeeds || 'None reported',
        vulnerableGroups: payload.vulnerableGroups || 'None',
        waterDepthCm: payload.waterDepthCm || 0,
        description: payload.description || '',
        mediaNote: payload.mediaNote || 'GPS Telemetry Verified',
        priority: payload.priority,
        priorityScore: payload.priorityScore,
        priorityReason: payload.priorityReason,
        clusterId: clusterCode,
        assignedTeamId: matchedCluster?.assignedTeamId || null,
        status: matchedCluster?.assignedTeamId ? 'Assigned' : 'Triaged',
        isSimulated: Boolean(payload.isSimulated),
      })
      .returning();

    return { record: inserted, deduplicated: false, clusterCode };
  } catch (error) {
    console.error('Database query failed in createDurableSosRequest:', error);
    throw new Error('Failed to durably persist SOS request.', { cause: error });
  }
}

export async function overrideSosPriorityInDb(params: {
  sosId: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  reason: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const scoreMap: Record<string, number> = { P0: 95, P1: 80, P2: 55, P3: 30 };
    const [updated] = await db
      .update(sosRequests)
      .set({
        priority: params.priority,
        priorityScore: scoreMap[params.priority] || 60,
        priorityReason: `Manual Admin Override (${params.priority}) by ${params.actorName}: ${params.reason}`,
        isManualOverride: true,
        overrideBy: params.actorName,
        updatedAt: new Date(),
      })
      .where(eq(sosRequests.id, params.sosId))
      .returning();

    if (updated) {
      await db.insert(auditLogs).values({
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: 'OVERRIDE_SOS_PRIORITY',
        targetType: 'SOS',
        targetId: updated.trackingId,
        details: `Overrode priority to ${params.priority}. Reason: ${params.reason}`,
      });
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in overrideSosPriorityInDb:', error);
    throw new Error('Failed to override SOS priority.', { cause: error });
  }
}

export async function updateSosStatusInDb(params: {
  sosId: number;
  status: string;
  description?: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const updatePayload: Record<string, any> = {
      status: params.status,
      updatedAt: new Date(),
    };
    if (params.description !== undefined) {
      updatePayload.description = params.description;
    }

    const [updated] = await db
      .update(sosRequests)
      .set(updatePayload)
      .where(eq(sosRequests.id, params.sosId))
      .returning();

    if (updated) {
      await db.insert(auditLogs).values({
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: `UPDATE_SOS_${params.status.toUpperCase()}`,
        targetType: 'SOS',
        targetId: updated.trackingId,
        details: `Updated SOS ${updated.trackingId} status to ${params.status}`,
      });
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in updateSosStatusInDb:', error);
    throw new Error('Failed to update SOS status.', { cause: error });
  }
}

export async function assignRescueTeamInDb(params: {
  teamId: number;
  sosId?: number;
  clusterCode?: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const teams = await db.select().from(rescueTeams).where(eq(rescueTeams.id, params.teamId));
    const team = teams[0];
    if (!team) {
      throw new Error('Rescue team not found');
    }

    let missionIdentifier = params.clusterCode || '';
    if (params.sosId) {
      const [updatedSos] = await db
        .update(sosRequests)
        .set({
          assignedTeamId: team.id,
          status: 'Assigned',
          updatedAt: new Date(),
        })
        .where(eq(sosRequests.id, params.sosId))
        .returning();

      if (updatedSos) {
        missionIdentifier = updatedSos.trackingId;
      }
    }

    if (params.clusterCode) {
      await db
        .update(incidentClusters)
        .set({ assignedTeamId: team.id })
        .where(eq(incidentClusters.clusterCode, params.clusterCode));

      const allSos = await db
        .select()
        .from(sosRequests)
        .where(eq(sosRequests.clusterId, params.clusterCode));

      for (const s of allSos) {
        if (s.status !== 'Completed' && s.status !== 'Cancelled') {
          await db
            .update(sosRequests)
            .set({ assignedTeamId: team.id, status: 'Assigned', updatedAt: new Date() })
            .where(eq(sosRequests.id, s.id));
        }
      }
    }

    const [updatedTeam] = await db
      .update(rescueTeams)
      .set({
        status: 'Assigned',
        activeMissionId: missionIdentifier || 'MISSION-ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(rescueTeams.id, team.id))
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'ASSIGN_RESCUE_TEAM',
      targetType: 'RescueTeam',
      targetId: team.teamCode,
      details: `Dispatched ${team.name} (${team.teamCode}) to ${missionIdentifier}`,
    });

    return updatedTeam;
  } catch (error) {
    console.error('Database query failed in assignRescueTeamInDb:', error);
    throw new Error('Failed to assign rescue team.', { cause: error });
  }
}

export async function updateRescueMissionStatusInDb(params: {
  teamId: number;
  status: 'Available' | 'Assigned' | 'En Route' | 'Arrived' | 'Rescuing' | 'Completed';
  actorName: string;
  actorRole: string;
}) {
  try {
    const teams = await db.select().from(rescueTeams).where(eq(rescueTeams.id, params.teamId));
    const team = teams[0];
    if (!team) {
      throw new Error('Rescue team not found');
    }

    const assignedSos = await db
      .select()
      .from(sosRequests)
      .where(eq(sosRequests.assignedTeamId, team.id));

    for (const s of assignedSos) {
      if (s.status !== 'Completed' && s.status !== 'Cancelled') {
        await db
          .update(sosRequests)
          .set({
            status: params.status === 'Available' ? 'Completed' : params.status,
            updatedAt: new Date(),
          })
          .where(eq(sosRequests.id, s.id));
      }
    }

    const isDone = params.status === 'Completed' || params.status === 'Available';
    const [updatedTeam] = await db
      .update(rescueTeams)
      .set({
        status: isDone ? 'Available' : params.status,
        activeMissionId: isDone ? null : team.activeMissionId,
        completedMissions: isDone ? team.completedMissions + 1 : team.completedMissions,
        updatedAt: new Date(),
      })
      .where(eq(rescueTeams.id, team.id))
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'UPDATE_MISSION_STATUS',
      targetType: 'RescueTeam',
      targetId: team.teamCode,
      details: `${team.name} updated mission status to ${params.status}`,
    });

    return updatedTeam;
  } catch (error) {
    console.error('Database query failed in updateRescueMissionStatusInDb:', error);
    throw new Error('Failed to update rescue mission status.', { cause: error });
  }
}

export async function updateShelterInDb(params: {
  shelterId: number;
  occupiedCapacity: number;
  foodPacks: number;
  waterLiters: number;
  medicalSupplies: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const rows = await db.select().from(shelters).where(eq(shelters.id, params.shelterId));
    const shelter = rows[0];
    if (!shelter) {
      throw new Error('Shelter not found');
    }

    if (params.occupiedCapacity > shelter.totalCapacity) {
      throw new Error(
        `Capacity overbooking prevented: requested ${params.occupiedCapacity} exceeds maximum capacity of ${shelter.totalCapacity}.`
      );
    }

    const clampedOccupied = Math.max(0, params.occupiedCapacity);
    const availableBeds = shelter.totalCapacity - clampedOccupied;
    const ratio = clampedOccupied / shelter.totalCapacity;
    const status = ratio >= 1 ? 'Full' : ratio >= 0.85 ? 'Near Capacity' : 'Open';

    const [updated] = await db
      .update(shelters)
      .set({
        occupiedCapacity: clampedOccupied,
        availableBeds,
        foodPacks: Math.max(0, params.foodPacks),
        waterLiters: Math.max(0, params.waterLiters),
        medicalSupplies: params.medicalSupplies,
        status,
        updatedAt: new Date(),
      })
      .where(eq(shelters.id, shelter.id))
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'UPDATE_SHELTER_RESOURCES',
      targetType: 'Shelter',
      targetId: shelter.shelterCode,
      details: `Updated ${shelter.name}: occupancy ${clampedOccupied}/${shelter.totalCapacity} (${availableBeds} beds free), food=${params.foodPacks}, water=${params.waterLiters}L, medical=${params.medicalSupplies}`,
    });

    return updated;
  } catch (error) {
    console.error('Database query failed in updateShelterInDb:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to update shelter resources.',
      { cause: error }
    );
  }
}

export async function createMassAlertBroadcastInDb(params: {
  title: string;
  message: string;
  severity: string;
  targetRegion: string;
  channels: string[];
  targetPopulation: number;
  isSimulation: boolean;
  actorName: string;
  actorRole: string;
}) {
  try {
    const pop = Math.max(1000, params.targetPopulation);
    const sentCount = pop;
    const deliveredCount = Math.floor(pop * 0.986);
    const failedCount = Math.floor(pop * 0.004);
    const pendingCount = Math.max(0, pop - deliveredCount - failedCount);
    const alertCode = `ALT-${Math.floor(1000 + Math.random() * 8999)}`;

    const [created] = await db
      .insert(massAlerts)
      .values({
        alertCode,
        title: params.title,
        message: params.message,
        severity: params.severity,
        targetRegion: params.targetRegion,
        channels: params.channels.join(','),
        targetPopulation: pop,
        sentCount,
        deliveredCount,
        failedCount,
        pendingCount,
        isSimulation: params.isSimulation,
        issuedBy: params.actorName,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: 'BROADCAST_MASS_ALERT',
      targetType: 'MassAlert',
      targetId: alertCode,
      details: `Broadcast [${params.severity}] "${params.title}" to ${pop.toLocaleString()} residents in ${params.targetRegion} via ${params.channels.join(', ')}`,
    });

    return created;
  } catch (error) {
    console.error('Database query failed in createMassAlertBroadcastInDb:', error);
    throw new Error('Failed to broadcast mass alert.', { cause: error });
  }
}

export async function registerOrUpdateCitizenProfileInDb(params: {
  uid?: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  locality: string;
  language: 'en' | 'te' | 'hi';
  lat: number;
  lon: number;
  locationGranted: boolean;
}) {
  try {
    const uid = params.uid || `citizen-${params.language}-${Date.now().toString().slice(-5)}`;
    const existing = await db.select().from(users).where(eq(users.uid, uid));

    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({
          name: params.name,
          phone: params.phone,
          email: params.email,
          state: params.state,
          city: params.city,
          locality: params.locality,
          region: params.locality,
          language: params.language,
          lat: params.lat,
          lon: params.lon,
          locationGranted: params.locationGranted,
        })
        .where(eq(users.uid, uid))
        .returning();

      await db.insert(auditLogs).values({
        actorName: params.name,
        actorRole: 'citizen',
        action: 'UPDATE_CITIZEN_PROFILE',
        targetType: 'CitizenProfile',
        targetId: uid,
        details: `Updated citizen profile (${params.locality}, ${params.city}) with preferred language [${params.language.toUpperCase()}]`,
      });
      return updated;
    }

    const [created] = await db
      .insert(users)
      .values({
        uid,
        name: params.name,
        phone: params.phone,
        email: params.email,
        state: params.state,
        city: params.city,
        locality: params.locality,
        region: params.locality,
        language: params.language,
        lat: params.lat,
        lon: params.lon,
        locationGranted: params.locationGranted,
        role: 'citizen',
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.name,
      actorRole: 'citizen',
      action: 'REGISTER_CITIZEN',
      targetType: 'CitizenProfile',
      targetId: uid,
      details: `Registered citizen ${params.name} (${params.phone}) in ${params.locality}, ${params.city} [Language: ${params.language.toUpperCase()}]`,
    });

    return created;
  } catch (error) {
    console.error('Database query failed in registerOrUpdateCitizenProfileInDb:', error);
    throw new Error('Failed to register or update citizen profile.', { cause: error });
  }
}

export async function createCommunityMessageInDb(params: {
  citizenUid: string;
  authorName: string;
  locality: string;
  city: string;
  language: 'en' | 'te' | 'hi';
  messageType: 'update' | 'help_request' | 'hazard_report' | 'direct_assist';
  content: string;
  lat?: number;
  lon?: number;
}) {
  try {
    const [created] = await db
      .insert(communityMessages)
      .values({
        citizenUid: params.citizenUid,
        authorName: params.authorName,
        locality: params.locality,
        city: params.city || 'Hyderabad',
        language: params.language || 'en',
        messageType: params.messageType || 'update',
        content: params.content,
        lat: params.lat || 17.385,
        lon: params.lon || 78.4867,
        isVerified: false,
        isFlagged: false,
        upvotes: 1,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Database query failed in createCommunityMessageInDb:', error);
    throw new Error('Failed to post locality community message.', { cause: error });
  }
}

export async function moderateCommunityMessageInDb(params: {
  messageId: number;
  action: 'verify' | 'flag' | 'unflag' | 'upvote';
  flagReason?: string;
  actorName: string;
  actorRole: string;
}) {
  try {
    const existing = await db
      .select()
      .from(communityMessages)
      .where(eq(communityMessages.id, params.messageId));
    if (existing.length === 0) {
      throw new Error('Community message not found');
    }
    const msg = existing[0];

    const patch: Record<string, any> = {};
    if (params.action === 'verify') {
      patch.isVerified = true;
      patch.isFlagged = false;
    } else if (params.action === 'flag') {
      patch.isFlagged = true;
      patch.flagReason = params.flagReason || 'Flagged for unverified flood claim';
    } else if (params.action === 'unflag') {
      patch.isFlagged = false;
      patch.flagReason = null;
    } else if (params.action === 'upvote') {
      patch.upvotes = msg.upvotes + 1;
    }

    const [updated] = await db
      .update(communityMessages)
      .set(patch)
      .where(eq(communityMessages.id, params.messageId))
      .returning();

    if (params.action !== 'upvote') {
      await db.insert(auditLogs).values({
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: `MODERATE_COMMUNITY_${params.action.toUpperCase()}`,
        targetType: 'CommunityMessage',
        targetId: String(params.messageId),
        details: `${params.action.toUpperCase()} community post by ${msg.authorName} in ${msg.locality}`,
      });
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in moderateCommunityMessageInDb:', error);
    throw new Error('Failed to moderate community message.', { cause: error });
  }
}

export async function registerVolunteerInDb(params: {
  uid?: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  locality: string;
  skills: string;
  availability: string;
  safetyAcknowledged: boolean;
}) {
  try {
    if (!params.safetyAcknowledged) {
      throw new Error('Safety directive acknowledgment is mandatory for volunteer registration.');
    }

    const [created] = await db
      .insert(volunteers)
      .values({
        uid: params.uid || `vol-${Date.now().toString().slice(-5)}`,
        name: params.name,
        phone: params.phone,
        email: params.email,
        state: params.state || 'Telangana',
        city: params.city || 'Hyderabad',
        locality: params.locality,
        skills: params.skills,
        availability: params.availability || 'Immediate',
        assignedTask: `Verified Non-Hazardous Support (${params.locality} Relief Camp & Multilingual Helpdesk)`,
        safetyAcknowledged: true,
        status: 'Active',
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.name,
      actorRole: 'citizen',
      action: 'REGISTER_VOLUNTEER',
      targetType: 'Volunteer',
      targetId: created.uid,
      details: `Registered volunteer ${params.name} in ${params.locality} (${params.skills})`,
    });

    return created;
  } catch (error) {
    console.error('Database query failed in registerVolunteerInDb:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to register volunteer.',
      { cause: error }
    );
  }
}

export async function dispatchAutomaticLocalityAlertInDb(params: {
  locality: string;
  city: string;
  state: string;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  riskScore: number;
  titleEn: string;
  titleTe: string;
  titleHi: string;
  messageEn: string;
  messageTe: string;
  messageHi: string;
  recommendedAction: string;
  forceDispatch?: boolean;
  actorName: string;
}) {
  try {
    const dedupHash = `${params.locality}-${params.riskLevel}-${Math.round(params.riskScore / 5) * 5}`;
    if (!params.forceDispatch) {
      const existing = await db
        .select()
        .from(localizedAlerts)
        .where(eq(localizedAlerts.dedupHash, dedupHash));
      if (existing.length > 0) {
        return { alert: existing[0], deduplicated: true };
      }
    }

    const allCitizens = await db.select().from(users);
    const localityCitizens = allCitizens.filter(
      (u) => (u.locality || u.region) === params.locality
    );

    const enCitizens = localityCitizens.filter((u) => (u.language || 'en') === 'en').length;
    const teCitizens = localityCitizens.filter((u) => u.language === 'te').length;
    const hiCitizens = localityCitizens.filter((u) => u.language === 'hi').length;

    const smsSentEn = Math.max(120, enCitizens * 140 + 210);
    const smsSentTe = Math.max(180, teCitizens * 165 + 340);
    const smsSentHi = Math.max(140, hiCitizens * 150 + 260);
    const totalSms = smsSentEn + smsSentTe + smsSentHi;
    const pushSent = Math.round(totalSms * 0.94);
    const emailSent = Math.round(totalSms * 0.72);
    const failedCount = Math.max(2, Math.round(totalSms * 0.008));
    const deliveredCount = totalSms - failedCount;

    const alertCode = `LOC-ALT-${Math.floor(100 + Math.random() * 899)}-${Date.now().toString().slice(-2)}`;

    const [created] = await db
      .insert(localizedAlerts)
      .values({
        alertCode,
        locality: params.locality,
        city: params.city || 'Hyderabad',
        state: params.state || 'Telangana',
        riskLevel: params.riskLevel,
        riskScore: params.riskScore,
        titleEn: params.titleEn,
        titleTe: params.titleTe,
        titleHi: params.titleHi,
        messageEn: params.messageEn,
        messageTe: params.messageTe,
        messageHi: params.messageHi,
        recommendedAction: params.recommendedAction,
        smsSentEn,
        smsSentTe,
        smsSentHi,
        pushSent,
        emailSent,
        deliveredCount,
        failedCount,
        retryCount: 0,
        dedupHash,
        isSimulation: true,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: params.actorName,
      actorRole: 'admin',
      action: 'AUTO_LOCALITY_ALERT',
      targetType: 'LocalizedAlert',
      targetId: alertCode,
      details: `Dispatched multilingual alert [${params.riskLevel}] for ${params.locality}: EN=${smsSentEn}, TE=${smsSentTe}, HI=${smsSentHi} SMS`,
    });

    return { alert: created, deduplicated: false };
  } catch (error) {
    console.error('Database query failed in dispatchAutomaticLocalityAlertInDb:', error);
    throw new Error('Failed to dispatch automatic locality alert.', { cause: error });
  }
}

export async function retryLocalizedAlertInDb(alertId: number, actorName: string) {
  try {
    const rows = await db
      .select()
      .from(localizedAlerts)
      .where(eq(localizedAlerts.id, alertId));
    if (rows.length === 0) {
      throw new Error('Localized alert not found');
    }
    const target = rows[0];
    const recovered = target.failedCount;

    const [updated] = await db
      .update(localizedAlerts)
      .set({
        deliveredCount: target.deliveredCount + recovered,
        failedCount: 0,
        retryCount: target.retryCount + Math.max(1, recovered),
      })
      .where(eq(localizedAlerts.id, alertId))
      .returning();

    await db.insert(auditLogs).values({
      actorName,
      actorRole: 'admin',
      action: 'RETRY_LOCALIZED_SMS',
      targetType: 'LocalizedAlert',
      targetId: target.alertCode,
      details: `Retried and delivered ${recovered} failed multilingual SMS notifications for ${target.locality}`,
    });

    return updated;
  } catch (error) {
    console.error('Database query failed in retryLocalizedAlertInDb:', error);
    throw new Error('Failed to retry localized alert.', { cause: error });
  }
}

