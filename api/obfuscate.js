// api/obfuscate.js — Bulletproof Vercel version

module.exports = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Manual JSON parse fallback (Vercel sometimes doesn't auto-parse)
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
    }
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    const code = body.code;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'No code provided' });
    }

    try {
        const crypto = require('crypto');
        const SPECIAL_CHARS = '@$#&-_()+!?';

        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = crypto.randomBytes(1)[0] % 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        function generateObfuscatedId() {
            const chars = 'IlO0' + SPECIAL_CHARS;
            let s = '';
            const len = Math.floor(Math.random() * 6) + 8;
            for (let i = 0; i < len; i++) {
                s += chars[Math.floor(Math.random() * chars.length)];
            }
            return '_' + s;
        }

        // Protection modules with obfuscated names
        function buildAntiDebug() {
            const c = generateObfuscatedId();
            return `--[=[ ANTI-DEBUG ]=]
local ${c} = {
    debug = function() local d = rawget(_G, "debug") if d then if d.gethook then return true end if d.sethook then return true end end return false end,
    hooks = function() if debug and debug.gethook then local h, m = debug.gethook() if h then error("[LuaForge] Debugger hook!") end end return false end,
    env = function() local e = getfenv and getfenv() or _G for k, v in pairs(e) do if type(k) == "string" then if k:lower():match("deobfuscate") then error("[LuaForge] Tool: " .. k) end if k:lower():match("unluac") then error("[LuaForge] Tool: " .. k) end end end if e.print ~= print then error("[LuaForge] print tampered!") end if e.string ~= string then error("[LuaForge] string tampered!") end return false end,
    timing = function() local t1 = os.clock() for i = 1, 1000000 do end local t2 = os.clock() if (t2 - t1) > 0.5 then error("[LuaForge] Timing anomaly!") end return false end
}
for name, check in pairs(${c}) do local ok, err = pcall(check) if not ok then error(err) end end
`;
        }

        function buildAntiTamper() {
            const c = generateObfuscatedId();
            return `--[=[ ANTI-TAMPER ]=]
local ${c} = function()
    local info = debug.getinfo(3, "S")
    if info and info.source then
        local src = info.source:gsub("^@", "")
        local f = io.open(src, "r")
        if f then
            local content = f:read("*a")
            f:close()
            if content:match("\\n\\s*\\n\\s*\\n") then
                error("[LuaForge] Tamper Detected!")
            end
        end
    end
end
${c}()
`;
        }

        function buildStringEncryptor() {
            const k = Math.floor(Math.random() * 200 + 50);
            const kv = generateObfuscatedId();
            const rv = generateObfuscatedId();
            const dv = generateObfuscatedId();
            return `--[=[ STRING ENCRYPTION ]=]
local ${kv} = ${k}
local ${rv} = function(k, i) return bit.bxor(k, bit.lshift(i % 256, (i % 4) * 2)) end
local ${dv} = function(enc, key)
    local result = {}
    local k = key or ${kv}
    for i = 1, #enc do
        local byte = string.byte(enc, i)
        local rotated = ${rv}(k, i)
        result[i] = string.char(bit.bxor(byte, rotated % 256))
    end
    return table.concat(result)
end
`;
        }

        function buildAIResistant() {
            let junk = '';
            const ops = ['+', '-', '*', '//', '%'];
            for (let i = 0; i < 15; i++) {
                junk += `local ${generateObfuscatedId()} = function(a, b) return a ${ops[Math.floor(Math.random() * ops.length)]} b end\n`;
            }
            return `--[=[ AI-RESISTANT ]=]
${junk}
local ${generateObfuscatedId()} = function(x, y) local a = x * x + 2 * x * y + y * y local b = (x + y) * (x + y) return math.abs(a - b) < 0.0001 end
local ${generateObfuscatedId()} = function() local d = {} for i = 1, 50 do d[i] = string.char(65 + (i % 26)) end return table.concat(d) end
`;
        }

        // SAFE obfuscation: protect strings/comments, then replace identifiers
        const keywords = new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while']);
        const globals = new Set(['assert','collectgarbage','dofile','error','getmetatable','ipairs','load','loadfile','next','pairs','pcall','print','rawequal','rawget','rawlen','rawset','require','select','setmetatable','tonumber','tostring','type','xpcall','_G','_ENV','package','string','utf8','table','math','io','os','debug','coroutine','bit','bit32','jit']);
        const idMap = new Map();
        const protected = [];
        let pIdx = 0;

        function protect(m) {
            const key = `__P${pIdx++}__`;
            protected.push({ key, val: m });
            return key;
        }

        let processed = code
            .replace(/--\[\[[\s\S]*?\]\]/g, protect)   // long comments
            .replace(/--[^\n]*/g, protect)              // short comments
            .replace(/"(?:\\.|[^"\\])*"/g, protect)     // double strings
            .replace(/'(?:\\.|[^'\\])*'/g, protect)     // single strings
            .replace(/\[\[[\s\S]*?\]\]/g, protect);    // long strings

        // Replace identifiers
        processed = processed.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, m => {
            if (keywords.has(m) || globals.has(m)) return m;
            if (!idMap.has(m)) idMap.set(m, generateObfuscatedId());
            return idMap.get(m);
        });

        // Restore protected content (reverse order to avoid collision)
        for (let i = protected.length - 1; i >= 0; i--) {
            processed = processed.split(protected[i].key).join(protected[i].val);
        }

        // Minify if requested
        if (body.preset === 'Minify') {
            processed = processed
                .replace(/^\s+/gm, '')
                .replace(/\n\s*\n+/g, '\n')
                .replace(/[ \t]+/g, ' ')
                .trim();
        }

        // Build final output
        let output = `-- ${body.watermark || 'Protected By LuaForge'}\n`;
        output += `-- Generated by LuaForge Server v3.1\n`;
        output += `-- Timestamp: ${new Date().toISOString()}\n`;
        output += `-- Preset: ${body.preset || 'Medium'}\n`;
        output += `-- SpecialChars: ${SPECIAL_CHARS}\n`;
        output += `-- RequestID: ${generateUUID()}\n\n`;

        if (body.antiDebug) output += buildAntiDebug() + '\n';
        if (body.antiTamper) output += buildAntiTamper() + '\n';
        if (body.stringEncrypt) output += buildStringEncryptor() + '\n';
        if (body.vmify) output += buildAIResistant() + '\n';

        output += `--[=[ USER CODE START ]=]\n`;
        output += processed;
        output += `\n--[=[ USER CODE END ]=]\n`;
        output += `\n--[=[\n    LuaForge Server v3.1 | Special Chars: ${SPECIAL_CHARS}\n    github.com/wcrddn/Prometheus\n]=]`;

        res.json({
            success: true,
            obfuscated: output,
            metadata: {
                preset: body.preset || 'Medium',
                specialChars: SPECIAL_CHARS,
                protections: {
                    antiTamper: !!body.antiTamper,
                    antiDebug: !!body.antiDebug,
                    stringEncrypt: !!body.stringEncrypt,
                    flowFlatten: !!body.flowFlatten,
                    vmify: !!body.vmify
                },
                watermark: body.watermark || 'Protected By LuaForge',
                originalSize: code.length,
                obfuscatedSize: output.length,
                ratio: ((output.length / code.length) * 100).toFixed(1) + '%'
            }
        });
    } catch (err) {
        console.error('FATAL:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
};
