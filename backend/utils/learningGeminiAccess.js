import supabase from '../services/supabaseClient.js';
import { isAdminUser } from './adminAccess.js';

/**
 * Ak je true, pri učení z tém sa Gemini volá len pre správcu (isAdminUser).
 * Ostatní: predgenerované JSON témy alebo lokálna šablóna (bez API).
 *
 * Predvolene zapnuté. Vypnutie: RESTRICT_LEARNING_AI_TO_ADMIN=false (alebo 0, off, no).
 */
export function isLearningGeminiRestricted() {
    const v = process.env.RESTRICT_LEARNING_AI_TO_ADMIN;
    if (v == null || String(v).trim() === '') {
        return true;
    }
    const s = String(v).trim().toLowerCase();
    if (s === '0' || s === 'false' || s === 'no' || s === 'off') {
        return false;
    }
    return true;
}

/** Môže táto relácia volať Gemini pri generovaní učebných materiálov / záverečného testu? */
export async function sessionMayUseLearningGemini(session) {
    if (!isLearningGeminiRestricted()) {
        return true;
    }
    const uid = session?.user_id;
    if (!uid) {
        return false;
    }
    const { data: row, error } = await supabase.from('users').select('email, name').eq('id', uid).maybeSingle();
    if (error || !row) {
        return false;
    }
    return isAdminUser(row);
}
