const crypto = require('crypto');

const SPECIAL_CHARS = '@$#&-_()+!?';

function generateObfuscatedId() {
    const chars = 'IlO0' + SPECIAL_CHARS;
    let s = '';
    const len = Math.floor(Math.random() * 6) + 8;
    for (let i = 0; i < len; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return '_' + s;
}

function generateAntiTamper() {
    const seed = crypto.randomBytes(8).toString('hex');
    return `--[=[
    ANTI-TAMPER MODULE v3.0
    Seed: ${seed}
]=]
local _AT_SEED = "${seed}"
local _AT_HASH = function(s)
    local h = 5381
    for i = 1, #s do
        h = bit.bxor(bit.lshift(h, 5), h) + string.byte(s, i)
    end
    return h
end
local _AT_CHECK = function()
    local info = debug.getinfo(3, "S")
    if info and info.source then
        local src = info.source:gsub("^@", "")
        local f = io.open(src, "r")
        if f then
            local content = f:read("*a")
            f:close()
            local lines = {}
            for line in content:gmatch("[^\\r\\n]+") do
                table.insert(lines, line)
            end
            local expected = #lines
            local actual = 0
            for _ in content:gmatch("\\n") do actual = actual + 1 end
            if math.abs(expected - actual) > 2 then
                error("[LuaForge] Tamper Detected! Line count mismatch.")
            end
            if content:match("\\n\\s*\\n\\s*\\n") then
                error("[LuaForge] Tamper Detected! Excessive whitespace detected.")
            end
        end
    end
end
_AT_CHECK()
`;
}

function generateAntiDebug() {
    return `--[=[
    ANTI-DEBUG / ANTI-ENVIRONMENT LOGGER v3.0
]=]
local _AD_CHECKS = {
    debug = function()
        local dbg = rawget(_G, "debug")
        if dbg then
            if dbg.gethook then return true end
            if dbg.sethook then return true end
            if dbg.getlocal then return true end
            if dbg.setlocal then return true end
            if dbg.getupvalue then return true end
            if dbg.setupvalue then return true end
            if dbg.getinfo then return true end
        end
        return false
    end,
    hooks = function()
        if debug and debug.gethook then
            local h, m = debug.gethook()
            if h then error("[LuaForge] Debugger hook detected!") end
        end
        return false
    end,
    env = function()
        local env = getfenv and getfenv() or _G
        for k, v in pairs(env) do
            if type(k) == "string" then
                if k:lower():match("deobfuscate") then error("[LuaForge] Deobfuscation tool detected: " .. k) end
                if k:lower():match("unluac") then error("[LuaForge] Deobfuscation tool detected: " .. k) end
                if k:lower():match("decompile") then error("[LuaForge] Deobfuscation tool detected: " .. k) end
                if k:lower():match("luadec") then error("[LuaForge] Deobfuscation tool detected: " .. k) end
                if k:lower():match("chunkspy") then error("[LuaForge] Deobfuscation tool detected: " .. k) end
            end
        end
        if env.print ~= print then error("[LuaForge] Global 'print' was tampered with!") end
        if env.string ~= string then error("[LuaForge] Global 'string' was tampered with!") end
        if env.table ~= table then error("[LuaForge] Global 'table' was tampered with!") end
        return false
    end,
    timing = function()
        local t1 = os.clock()
        for i = 1, 1000000 do end
        local t2 = os.clock()
        if (t2 - t1) > 0.5 then
            error("[LuaForge] Timing anomaly detected! Possible debugger attached.")
        end
        return false
    end
}
for name, check in pairs(_AD_CHECKS) do
    local ok, err = pcall(check)
    if not ok then error(err) end
end
`;
}

function generateAIResistant() {
    const junkOps = Array.from({length: 30}, (_, i) => {
        const ops = ['+', '-', '*', '/', '%', '^'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        return `local _JUNK_${SPECIAL_CHARS[Math.floor(Math.random()*SPECIAL_CHARS.length)]}${i} = function(a, b) return a ${op} b end`;
    }).join('\n');
    return `--[=[
    AI-RESISTANT OBFUSCATION LAYER v3.0
    Special Chars: ${SPECIAL_CHARS}
]=]
${junkOps}
local _AI_OPAQUE = function(x, y)
    local a = x * x + 2 * x * y + y * y
    local b = (x + y) * (x + y)
    return math.abs(a - b) < 0.0001
end
local _AI_DECOY = function()
    local decoy = {}
    for i = 1, 50 do
        decoy[i] = string.char(65 + (i % 26))
    end
    return table.concat(decoy)
end
_AI_DECOY()
`;
}

function generateStringEncryptor() {
    return `--[=[
    STRING ENCRYPTION MODULE v3.0
]=]
local _SE_KEY = ${Math.floor(Math.random() * 200 + 50)}
local _SE_ROTATE = function(k, i)
    return bit.bxor(k, bit.lshift(i % 256, (i % 4) * 2))
end
local _SE_DEC = function(enc, key)
    local result = {}
    local k = key or _SE_KEY
    for i = 1, #enc do
        local byte = string.byte(enc, i)
        local rotated = _SE_ROTATE(k, i)
        result[i] = string.char(bit.bxor(byte, rotated % 256))
    end
    return table.concat(result)
end
`;
}

function applySpecialCharObfuscation(code) {
    const idMap = new Map();
    const preserve = ['local','function','end','if','then','else','elseif','for','in','do','while','repeat','until','return','break','true','false','nil','not','and','or','print','pairs','ipairs','next','type','tonumber','tostring','assert','error','pcall','xpcall','require','module','select','unpack','load','loadfile','dofile','rawget','rawset','setmetatable','getmetatable','collectgarbage','_G','_ENV','string','table','math','os','io','debug','coroutine','bit','jit'];
    
    return code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match, name) => {
        if (preserve.includes(name)) return name;
        if (!idMap.has(name)) idMap.set(name, generateObfuscatedId());
        return idMap.get(name);
    });
}

function applyMinify(code) {
    return code
        .replace(/--[^\n]*/g, '')
        .replace(/^\s+/gm, '')
        .replace(/\n\s*\n+/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
}

function applyControlFlowFlattening(code) {
    const lines = code.split('\n');
    const states = lines.map((_, i) => `_STATE_${i}`);
    let result = `local _CF_STATE = 1\nlocal _CF_STATES = {}\n`;
    
    lines.forEach((line, i) => {
        result += `_CF_STATES[${i + 1}] = function()\n    ${line}\n    _CF_STATE = ${i + 2}\nend\n`;
    });
    
    result += `_CF_STATES[${lines.length + 1}] = function() end\n`;
    result += `while _CF_STATE <= ${lines.length} do\n    _CF_STATES[_CF_STATE]()\nend\n`;
    return result;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { code, preset, antiTamper, antiDebug, stringEncrypt, flowFlatten, vmify, watermark } = req.body;
        
        if (!code) return res.status(400).json({ error: 'No code provided' });

        let finalSource = '';
        finalSource += `-- ${watermark || 'Protected By LuaForge'}\n`;
        finalSource += `-- Generated by LuaForge Server v3.0\n`;
        finalSource += `-- Timestamp: ${new Date().toISOString()}\n`;
        finalSource += `-- Preset: ${preset || 'Medium'}\n`;
        finalSource += `-- SpecialChars: ${SPECIAL_CHARS}\n`;
        finalSource += `-- RequestID: ${crypto.randomUUID()}\n\n`;

        if (antiDebug) {
            finalSource += generateAntiDebug();
            finalSource += '\n';
        }
        if (antiTamper) {
            finalSource += generateAntiTamper();
            finalSource += '\n';
        }
        if (stringEncrypt) {
            finalSource += generateStringEncryptor();
            finalSource += '\n';
        }
        if (vmify) {
            finalSource += generateAIResistant();
            finalSource += '\n';
        }

        finalSource += `--[=[ USER CODE START ]=]\n`;
        finalSource += code;
        finalSource += `\n--[=[ USER CODE END ]=]\n`;

        let obfuscatedCode = finalSource;

        if (preset === 'Minify') {
            obfuscatedCode = applyMinify(obfuscatedCode);
        } else if (preset === 'Weak') {
            obfuscatedCode = applySpecialCharObfuscation(obfuscatedCode);
        } else {
            if (flowFlatten) {
                obfuscatedCode = applyControlFlowFlattening(obfuscatedCode);
            }
            obfuscatedCode = applySpecialCharObfuscation(obfuscatedCode);
        }

        obfuscatedCode += `\n\n--[=[
    END OF OBFUSCATED SCRIPT
    LuaForge Server v3.0 | Special Chars: ${SPECIAL_CHARS}
    github.com/wcrddn/Prometheus
]=]`;

        res.json({
            success: true,
            obfuscated: obfuscatedCode,
            metadata: {
                preset: preset || 'Medium',
                specialChars: SPECIAL_CHARS,
                protections: {
                    antiTamper: !!antiTamper,
                    antiDebug: !!antiDebug,
                    stringEncrypt: !!stringEncrypt,
                    flowFlatten: !!flowFlatten,
                    vmify: !!vmify
                },
                watermark: watermark || 'Protected By LuaForge',
                originalSize: code.length,
                obfuscatedSize: obfuscatedCode.length,
                ratio: ((obfuscatedCode.length / code.length) * 100).toFixed(1) + '%'
            }
        });
    } catch (err) {
        console.error('Obfuscation error:', err);
        res.status(500).json({
            error: 'Obfuscation failed',
            message: err.message
        });
    }
};
                            
