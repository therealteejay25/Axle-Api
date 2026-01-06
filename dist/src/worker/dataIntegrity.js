"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectUnexpectedOutput = exports.validateActionOutput = exports.validateParameters = exports.resolveParameter = void 0;
const logger_1 = require("../services/logger");
// ============================================
// PARAMETER RESOLUTION
// ============================================
// Helper: Get nested value from object
const getNestedValue = (obj, path) => {
    if (!path)
        return obj;
    return path.split('.').reduce((current, key) => current?.[key], obj);
};
// Resolve parameter from memory or previous actions
const resolveParameter = (paramValue, memory, previousResults) => {
    // Template pattern: {{source.field}}
    const templateMatch = paramValue.match(/\{\{([^}]+)\}\}/);
    if (!templateMatch) {
        // Not a template, return as-is
        return { value: paramValue, source: 'literal', valid: true };
    }
    const path = templateMatch[1].trim();
    const [source, ...fieldParts] = path.split('.');
    const field = fieldParts.join('.');
    // Check previous action results first
    if (previousResults[source]) {
        const value = field ? getNestedValue(previousResults[source], field) : previousResults[source];
        if (value === undefined || value === null) {
            return {
                value: null,
                source: 'previous_action',
                valid: false,
                error: `Field "${field}" not found in "${source}" result`
            };
        }
        return {
            value,
            source: 'previous_action',
            valid: true
        };
    }
    // Check memory for facts
    const memoryEntry = memory.find(m => m.type === 'fact' && m.payload && typeof m.payload === 'object');
    if (memoryEntry && memoryEntry.payload[source]) {
        const value = field ? getNestedValue(memoryEntry.payload[source], field) : memoryEntry.payload[source];
        if (value === undefined || value === null) {
            return {
                value: null,
                source: 'memory',
                valid: false,
                error: `Field "${field}" not found in memory entry "${source}"`
            };
        }
        return {
            value,
            source: 'memory',
            valid: true
        };
    }
    return {
        value: null,
        source: 'unknown',
        valid: false,
        error: `Source "${source}" not found in previous results or memory`
    };
};
exports.resolveParameter = resolveParameter;
// Validate all parameters before execution
const validateParameters = (params, memory, previousResults) => {
    const errors = [];
    const resolvedParams = {};
    for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'string' && value.includes('{{')) {
            // Template parameter - resolve it
            const resolution = (0, exports.resolveParameter)(value, memory, previousResults);
            if (!resolution.valid) {
                errors.push(`Parameter "${key}": ${resolution.error}`);
                logger_1.logger.warn('Parameter resolution failed', {
                    parameter: key,
                    template: value,
                    error: resolution.error
                });
            }
            else {
                resolvedParams[key] = resolution.value;
                logger_1.logger.debug('Parameter resolved', {
                    parameter: key,
                    template: value,
                    resolved: resolution.value,
                    source: resolution.source
                });
            }
        }
        else if (typeof value === 'object' && value !== null) {
            // Recursively resolve nested objects
            const nested = (0, exports.validateParameters)(value, memory, previousResults);
            if (!nested.valid) {
                errors.push(...nested.errors);
            }
            resolvedParams[key] = nested.resolvedParams;
        }
        else {
            // Literal value
            resolvedParams[key] = value;
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        resolvedParams
    };
};
exports.validateParameters = validateParameters;
// ============================================
// OUTPUT VALIDATION
// ============================================
// Validate action output against expected contract
const validateActionOutput = (actionType, result, contract) => {
    const errors = [];
    const warnings = [];
    const extractedData = {};
    if (!result || typeof result !== 'object') {
        return {
            valid: false,
            errors: ['Result is not an object'],
            warnings: [],
            extractedData: {}
        };
    }
    for (const field of contract) {
        const value = result[field.field];
        // Check required fields
        if (field.required && (value === undefined || value === null)) {
            errors.push(`Required field missing: ${field.field}`);
            continue;
        }
        // Skip validation for optional missing fields
        if (!field.required && (value === undefined || value === null)) {
            continue;
        }
        // Type validation
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (value !== undefined && actualType !== field.type) {
            errors.push(`Field "${field.field}": expected ${field.type}, got ${actualType}`);
            continue;
        }
        // Pattern validation for strings
        if (field.validation?.pattern && typeof value === 'string') {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
                errors.push(`Field "${field.field}": does not match pattern ${field.validation.pattern}`);
                continue;
            }
        }
        // Min/max validation
        if (field.validation?.min !== undefined) {
            const length = typeof value === 'string' ? value.length : value;
            if (length < field.validation.min) {
                errors.push(`Field "${field.field}": below minimum ${field.validation.min}`);
                continue;
            }
        }
        if (field.validation?.max !== undefined) {
            const length = typeof value === 'string' ? value.length : value;
            if (length > field.validation.max) {
                warnings.push(`Field "${field.field}": above maximum ${field.validation.max}`);
            }
        }
        // Store validated data
        if (value !== undefined) {
            extractedData[field.field] = value;
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        extractedData
    };
};
exports.validateActionOutput = validateActionOutput;
// Detect unexpected output (null, empty, error-like)
const detectUnexpectedOutput = (result) => {
    if (result === null || result === undefined) {
        return true;
    }
    if (typeof result === 'object' && Object.keys(result).length === 0) {
        return true;
    }
    // Check for error-like properties
    if (result.error || result.failed || result.success === false) {
        return true;
    }
    return false;
};
exports.detectUnexpectedOutput = detectUnexpectedOutput;
