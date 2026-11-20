export type ExtractedItem = {id:string; title:string;url:string;source:string;capturedAt:string;isNew:boolean};
export type AgentEvent = {id:number;time:string;type:string;message:string};
export type Session = {id:string;url:string;status:'idle'|'running'|'completed'|'failed';startedAt:string;finishedAt?:string;items:ExtractedItem[];events:AgentEvent[];screenshot?:string;error?:string};
