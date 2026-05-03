import supabase from '../services/supabaseClient.js';
import { isAdminUser } from './adminAccess.js';

/**
 * Ak je true, pri učení z tém sa Gemini volá len pre správcu (isAdminUser).
 * Predvolene vypnuté — Gemini pri učení môže hocikto (prihlásený s reláciou).
 * Zapnutie obmedzenia: RESTRICT_LEARNING_AI_TO_ADMIN=true (alebo 1, yes, on).
 */
export function isLearningGeminiRestricted() {
    const v = process.env.RESTRICT_LEARNING_AI_TO_ADMIN;
    if (v == null || String(v).trim() === '') {
        return false;
    }
    const s = String(v).trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'on') {
        return true;
    }
    return false;
}

/**
 * Môže táto relácia volať Gemini pri generovaní učebných materiálov / záverečného testu?
 * Katalógové témy s backend/data/preGeneratedLearning/topic-*.json Gemini nepotrebujú — tam sa AI nepoužije bez ohľadu na túto funkciu.
 */
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
