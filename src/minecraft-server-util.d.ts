declare module 'minecraft-server-util' {
  interface StatusOptions {
    timeout?: number;
  }

  interface StatusResponse {
    version: { name: string; protocol: number };
    players: { online: number; max: number };
    motd: { clean: string; raw: string; html: string };
    favicon: string | null;
  }

  export function status(host: string, port?: number, options?: StatusOptions): Promise<StatusResponse>;
}
