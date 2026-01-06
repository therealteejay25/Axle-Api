"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoSessionService = void 0;
const Execution_1 = require("../models/Execution");
const logger_1 = require("./logger");
class MongoSessionService {
    async getSession(sessionId) {
        return this.load(sessionId);
    }
    async createSession(session) {
        await this.save(session);
    }
    async listSessions() {
        return [];
    }
    async deleteSession(sessionId) {
        // No-op
    }
    currentSessionId;
    setContext(sessionId) {
        this.currentSessionId = sessionId;
    }
    async load(sessionIdOrObj) {
        // ADK may pass an object with sessionId property or just the string
        let sessionId = typeof sessionIdOrObj === 'string'
            ? sessionIdOrObj
            : sessionIdOrObj?.sessionId;
        // Fallback/Hack for ADK Runner dropping context
        if (!sessionId && this.currentSessionId) {
            sessionId = this.currentSessionId;
        }
        if (!sessionId) {
            logger_1.logger.warn('MongoSessionService.load called without valid sessionId', {
                input: typeof sessionIdOrObj === 'object' ? JSON.stringify(sessionIdOrObj) : sessionIdOrObj
            });
            return undefined;
        }
        const execution = await Execution_1.Execution.findById(sessionId);
        if (!execution)
            return undefined;
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
        logger_1.logger.info('MongoSessionService.load success', {
            id: session.id,
            historyLength: session.history.length
        });
        return session;
    }
    async appendEvent(request) {
        const { session, event } = request;
        if (!session.events)
            session.events = [];
        session.events.push(event);
        // Sync history for legacy compatibility
        session.history = session.events;
        await this.save(session);
    }
    async save(session) {
        if (!session.id) {
            // Fallback
            if (this.currentSessionId) {
                session.id = this.currentSessionId;
            }
            else {
                // logger.warn('MongoSessionService.save called without session.id', { session });
                // Suppress warn if saving initial state without ID (though rare)
                return;
            }
        }
        // Ensure state exists
        const newState = session.state || {};
        // Save history/events inside state
        newState._adk_history = session.events || session.history || [];
        await Execution_1.Execution.updateOne({ _id: session.id }, { $set: { state: newState } } // Don't touch 'memory' field
        );
    }
}
exports.MongoSessionService = MongoSessionService;
