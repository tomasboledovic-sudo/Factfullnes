import jwt from 'jsonwebtoken';
import supabase from '../services/supabaseClient.js';
import { isAdminUser } from '../utils/adminAccess.js';

/**
 * Voliteľný JWT middleware — nastaví req.userId ak je token platný,
 * ale neprerušuje request ak token chýba alebo je neplatný.
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.userId = null;
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
    } catch {
        req.userId = null;
    }

    next();
}

/**
 * Povinný JWT middleware — vráti 401 ak token chýba alebo je neplatný.
 */
export function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Prihlásenie je vyžadované' }
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Token je neplatný alebo expiroval' }
        });
    }
}

/**
 * Vyžaduje requireAuth (req.userId). Povolí len „správcu“ — pozri isAdminUser v adminAccess.js.
 */
export async function requireAdmin(req, res, next) {
    if (!req.userId) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Prihlásenie je vyžadované' }
        });
    }
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('email, name')
            .eq('id', req.userId)
            .maybeSingle();
        if (error || !user) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Prístup zamietnutý' }
            });
        }
        if (!isAdminUser(user)) {
            return res.status(403).json({
                success: false,
                error: { code: 'ADMIN_ONLY', message: 'Táto funkcia je len pre správcu.' }
            });
        }
        next();
    } catch (e) {
        next(e);
    }
}
