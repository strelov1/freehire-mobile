export interface ToolCall {
  name: string;
  input?: unknown;
  result?: string;
  isError?: boolean;
}
