import { SessionService, Session } from '@google/adk';
import { Execution } from '../models/Execution';

export class MongoSessionService implements SessionService {
  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.load(sessionId);
  }

  async createSession(session: Session): Promise<void> {
    await this.save(session);
  }

  async listSessions(): Promise<Session[]> {
    return []; 
  }

  async deleteSession(sessionId: string): Promise<void> {
    // No-op
  }

  async load(sessionIdOrObj: string | any): Promise<Session | undefined> {
    // ADK may pass an object with sessionId property or just the string
    const sessionId = typeof sessionIdOrObj === 'string' 
      ? sessionIdOrObj 
      : sessionIdOrObj?.sessionId;
    
    if (!sessionId) {
      console.warn('MongoSessionService.load called without valid sessionId', sessionIdOrObj);
      return undefined;
    }
    
    const execution = await Execution.findById(sessionId);
    if (!execution) return undefined;
    
    return {
      id: execution._id.toString(),
      state: execution.state || {},
      history: execution.memory ? (execution.memory as any) : []
    };
  }

  async save(session: Session): Promise<void> {
    if (!session.id) {
      console.warn('MongoSessionService.save called without session.id', session);
      return;
    }
    
    await Execution.updateOne(
      { _id: session.id },
      { $set: { state: session.state, memory: session.history } }
    );
  }
}
