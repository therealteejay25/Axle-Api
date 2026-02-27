
import { SessionService, Session } from '@google/adk';
import { Execution } from '../models/Execution';
import { logger } from './logger';

export class MongoSessionService implements SessionService {
  async getSession(request: { sessionId: string } | string): Promise<Session | undefined> {
    const sessionId = typeof request === 'string' ? request : request.sessionId;
    return this.load(sessionId);
  }

  async createSession(session: Session): Promise<Session> {
    await this.save(session);
    return session;
  }

  async listSessions(): Promise<{ sessions: Session[] }> {
    return { sessions: [] }; 
  }

  async deleteSession(request: { sessionId: string } | string): Promise<void> {
    // No-op
  }

  private currentSessionId?: string;

  setContext(sessionId: string) {
    this.currentSessionId = sessionId;
  }

  async load(sessionIdOrObj: string | any): Promise<Session | undefined> {
    // ADK may pass an object with sessionId property or just the string
    let sessionId = typeof sessionIdOrObj === 'string' 
      ? sessionIdOrObj 
      : sessionIdOrObj?.sessionId;

    // Fallback/Hack for ADK Runner dropping context
    if (!sessionId && this.currentSessionId) {
        sessionId = this.currentSessionId;
    }

    if (!sessionId) {
      logger.warn('MongoSessionService.load called without valid sessionId', { 
        input: typeof sessionIdOrObj === 'object' ? JSON.stringify(sessionIdOrObj) : sessionIdOrObj 
      });
      return undefined;
    }
    
    const execution = await Execution.findById(sessionId);
    if (!execution) return undefined;
    
    // Use state._adk_history for history/events to avoid conflict with 'memory' Map
    const adkHistory = execution.state?._adk_history;
    const historyArray = Array.isArray(adkHistory) ? adkHistory : [];

    // ADK Runner expects 'events' property. We map it to the same history array.
    const session = {
      id: execution._id.toString(),
      state: execution.state || {},
      history: historyArray,
      events: historyArray, 
      turns: []
    };
    
    logger.info('MongoSessionService.load success', { 
        id: session.id, 
        historyLength: session.history.length
    });
    
    return session as any;
  }

  async appendEvent(request: { session: Session; event: any }): Promise<any> {
    const { session, event } = request;
    if (!session.events) session.events = [];
    session.events.push(event);
    // Sync history for legacy compatibility
    session.history = session.events;
    await this.save(session);
    return event;
  }

  async updateSessionState(request: { session: Session; stateDelta: Record<string, any> }): Promise<void> {
    const { session, stateDelta } = request;
    if (!session.state) session.state = {};
    Object.assign(session.state, stateDelta);
    await this.save(session);
  }

  async save(session: Session): Promise<void> {
    if (!session.id) {
        // Fallback
        if (this.currentSessionId) {
            session.id = this.currentSessionId;
        } else {
            // logger.warn('MongoSessionService.save called without session.id', { session });
            // Suppress warn if saving initial state without ID (though rare)
            return;
        }
    }

    // Ensure state exists
    const newState = session.state || {};
    // Save history/events inside state
    newState._adk_history = session.events || session.history || [];

    await Execution.updateOne(
      { _id: session.id },
      { $set: { state: newState } } // Don't touch 'memory' field
    );
  }
}
