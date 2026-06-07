export interface AgentIngestPayload {
  guildId: string;
  channelId: string;
  userId: string;
  userName: string;
  content: string;
  messageId: string;
  isModerator: boolean;
}

export function isAgentConfigured(): boolean {
  return Boolean(process.env.AGENT_SERVICE_URL && process.env.INTERNAL_SECRET);
}

// Fire-and-forget hand-off to the agent service. The agent processes the
// message on its own FIFO queue and posts the reply back via /internal/reply.
export async function forwardToAgent(payload: AgentIngestPayload): Promise<void> {
  const base = process.env.AGENT_SERVICE_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) throw new Error('agent service not configured');

  const res = await fetch(`${base.replace(/\/$/, '')}/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`agent ingest failed: ${res.status} ${await res.text()}`);
  }
}

export type ModGateKind = 'approve' | 'merge';
export type ModGateDecision = 'approve' | 'deny';

// Relays a mod's approval/merge decision back to the agent. (M4)
export async function agentModGate(
  kind: ModGateKind,
  taskId: number,
  seq: number,
  decision: ModGateDecision,
): Promise<void> {
  const base = process.env.AGENT_SERVICE_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) throw new Error('agent service not configured');

  const res = await fetch(`${base.replace(/\/$/, '')}/gate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ kind, taskId, seq, decision }),
  });

  if (!res.ok) {
    throw new Error(`agent gate failed: ${res.status} ${await res.text()}`);
  }
}

export type ConfirmAction = 'start' | 'cancel';

// Relays a requester's plan confirmation (Start/Cancel) back to the agent.
export async function agentConfirm(taskId: number, action: ConfirmAction): Promise<void> {
  const base = process.env.AGENT_SERVICE_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) throw new Error('agent service not configured');

  const res = await fetch(`${base.replace(/\/$/, '')}/confirm`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ taskId, action }),
  });

  if (!res.ok) {
    throw new Error(`agent confirm failed: ${res.status} ${await res.text()}`);
  }
}

export async function agentStop(taskId: number, reason?: string): Promise<void> {
  const base = process.env.AGENT_SERVICE_URL;
  const secret = process.env.INTERNAL_SECRET;
  if (!base || !secret) throw new Error('agent service not configured');

  const res = await fetch(`${base.replace(/\/$/, '')}/stop`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ taskId, reason }),
  });

  if (!res.ok) {
    throw new Error(`agent stop failed: ${res.status} ${await res.text()}`);
  }
}
