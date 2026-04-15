import { createClient } from '@supabase/supabase-js';

let _client = null;
let warnedServiceRole = false;

function getClient() {
    if (!_client) {
        const url = process.env.SUPABASE_URL;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        const anon = process.env.SUPABASE_ANON_KEY?.trim();
        const key = serviceRole || anon;
        if (!url || !key) {
            throw new Error(
                'SUPABASE_URL a SUPABASE_ANON_KEY (alebo SUPABASE_SERVICE_ROLE_KEY) musia byť nastavené'
            );
        }
        if (!serviceRole && !warnedServiceRole) {
            warnedServiceRole = true;
            console.warn(
                '[supabase] Používa sa anon kľúč. Ak registrácia/login padá na oprávnenia (RLS), pridaj do .env SUPABASE_SERVICE_ROLE_KEY z Supabase → Settings → API.'
            );
        }
        _client = createClient(url, key);
    }
    return _client;
}

const supabase = new Proxy({}, {
    get(_, prop) {
        return getClient()[prop];
    }
});

export default supabase;
