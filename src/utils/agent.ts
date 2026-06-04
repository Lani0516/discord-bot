export interface AgentIngestPayload {
  guildId: string;
  channelId: string;
  userId: string;
  userName: string;
  content: string;
  messageId: string;
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
