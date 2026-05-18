declare module 'minecraft-server-util' {
  interface StatusOptions {
    timeout?: number;
  }

  interface StatusResponse {
    version: { name: string; protocol: number };
    players: {
      online: number;
      max: number;
      sample: { name: string; id: string }[] | null;
    };
    motd: { clean: string; raw: string; html: string };
    favicon: string | null;
    roundTripLatency: number;
  }

  export function status(host: string, port?: number, options?: StatusOptions): Promise<StatusResponse>;
}
