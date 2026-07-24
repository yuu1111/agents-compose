export class AgentsComposeError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "AgentsComposeError";
	}
}

export function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
