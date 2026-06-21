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

function generateAntiTamper() {
    const seed = crypto.randomBytes(8).toString('hex');
    const checkName = generateObfuscatedId();
    const hashName = generateObfuscatedId();
    const seedVar = generateObfuscatedId();
    return `
--[=[
    ANTI-TAMPER MODULE
    Seed: ${seed}
]=]
local ${seedVar} = "${seed}"
local ${hashName} = function(s)
    local h = 5381
    for i = 1, #s do
        h = bit.bxor(bit.lshift(h, 5), h) + string.byte(s, i)
    end
    return h
end
local ${checkName} = function()
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
                error("[LuaForge] Tamper Detected!")
            end
        end
    end
end
${checkName}()
`;
}

function generateAntiDebug() {
    const checksName = generateObfuscatedId();
    return `
--[=[
    ANTI-DEBUG / ANTI-ENV
]=]
local ${checksName} = {
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
                if k:lower():match("deobfuscate") then error("[LuaForge] Tool detected: " .. k) end
                if k:lower():match("unluac") then error("[LuaForge] Tool detected: " .. k) end
                if k:lower():match("decompile") then error("[LuaForge] Tool detected: " .. k) end
                if k:lower():match("luadec") then error("[LuaForge] Tool detected: " .. k) end
                if k:lower():match("chunkspy") then error("[LuaForge] Tool detected: " .. k) end
            end
        end
        if env.print ~= print then error("[LuaForge] Global 'print' tampered!") end
        if env.string ~= string then error("[LuaForge] Global 'string' tampered!") end
        if env.table ~= table then error("[LuaForge] Global 'table' tampered!") end
        return false
    end,
    timing = function()
        local t1 = os.clock()
        for i = 1, 1000000 do end
        local t2 = os.clock()
        if (t2 - t1) > 0.5 then
            error("[LuaForge] Timing anomaly! Debugger attached.")
        end
        return false
    end
}
for name, check in pairs(${checksName}) do
    local ok, err = pcall(check)
    if not ok then error(err) end
end
`;
}

function generateStringEncryptor() {
    const key = Math.floor(Math.random() * 200 + 50);
    const keyVar = generateObfuscatedId();
    const rotateVar = generateObfuscatedId();
    const decVar = generateObfuscatedId();
    return `
--[=[
    STRING ENCRYPTION
]=]
local ${keyVar} = ${key}
local ${rotateVar} = function(k, i)
    return bit.bxor(k, bit.lshift(i % 256, (i % 4) * 2))
end
local ${decVar} = function(enc, key)
    local result = {}
    local k = key or ${keyVar}
    for i = 1, #enc do
        local byte = string.byte(enc, i)
        local rotated = ${rotateVar}(k, i)
        result[i] = string.char(bit.bxor(byte, rotated % 256))
    end
    return table.concat(result)
end
`;
}

function generateAIResistant() {
    const junkCount = 20;
    let junk = '';
    const ops = ['+', '-', '*', '//', '%'];
    for (let i = 0; i < junkCount; i++) {
        const op = ops[Math.floor(Math.random() * ops.length)];
        junk += `local ${generateObfuscatedId()} = function(a, b) return a ${op} b end\n`;
    }
    const opaqueVar = generateObfuscatedId();
    const decoyVar = generateObfuscatedId();
    return `
--[=[
    AI-RESISTANT LAYER
    Special Chars: ${SPECIAL_CHARS}
]=]
${junk}
local ${opaqueVar} = function(x, y)
    local a = x * x + 2 * x * y + y * y
    local b = (x + y) * (x + y)
    return math.abs(a - b) < 0.0001
end
local ${decoyVar} = function()
    local decoy = {}
    for i = 1, 50 do
        decoy[i] = string.char(65 + (i % 26))
    end
    return table.concat(decoy)
end
${decoyVar}()
`;
}

function tokenizeLua(code) {
    const tokens = [];
    const regex = /(--\[(=*)\[([\s\S]*?)\]\2\])|(--[^\n]*)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\[(=*)\[([\s\S]*?)\]\7\])|([a-zA-Z_][a-zA-Z0-9_]*)|(\d+\.?\d*)|(\.\d+)|([+\-*/%^#=<>~]=|[.]{2,3}|[+\-*/%^#=<>~(){}[\],;])|(\s+)|(.)/g;
    
    let match;
    while ((match = regex.exec(code)) !== null) {
        const full = match[0];
        const longComment = match[1];
        const shortComment = match[4];
        const doubleString = match[5];
        const singleString = match[6];
        const longString = match[7];
        const identifier = match[9];
        const number = match[10];
        const dotNumber = match[11];
        const operator = match[12];
        const whitespace = match[13];
        
        if (identifier) {
            tokens.push({ type: 'identifier', value: identifier });
        } else if (doubleString || singleString || longString) {
            tokens.push({ type: 'string', value: full });
        } else if (number || dotNumber) {
            tokens.push({ type: 'number', value: full });
        } else if (shortComment || longComment) {
            tokens.push({ type: 'comment', value: full });
        } else if (operator) {
            tokens.push({ type: 'operator', value: full });
        } else if (whitespace) {
            tokens.push({ type: 'whitespace', value: full });
        } else {
            tokens.push({ type: 'other', value: full });
        }
    }
    return tokens;
}

const LUA_KEYWORDS = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
    'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or',
    'repeat', 'return', 'then', 'true', 'until', 'while'
]);

const LUA_GLOBALS = new Set([
    'assert', 'collectgarbage', 'dofile', 'error', 'getmetatable',
    'ipairs', 'load', 'loadfile', 'next', 'pairs', 'pcall', 'print',
    'rawequal', 'rawget', 'rawlen', 'rawset', 'require', 'select',
    'setmetatable', 'tonumber', 'tostring', 'type', 'xpcall',
    '_G', '_ENV', 'package', 'string', 'utf8', 'table', 'math',
    'io', 'os', 'debug', 'coroutine', 'bit', 'bit32', 'jit'
]);

function obfuscateIdentifiers(code) {
    const tokens = tokenizeLua(code);
    const idMap = new Map();
    let result = '';
    
    for (const token of tokens) {
        if (token.type === 'identifier') {
            const name = token.value;
            if (LUA_KEYWORDS.has(name) || LUA_GLOBALS.has(name)) {
                result += name;
            } else {
                if (!idMap.has(name)) {
                    idMap.set(name, generateObfuscatedId());
                }
                result += idMap.get(name);
            }
        } else {
            result += token.value;
        }
    }
    
    return result;
}

function applyMinify(code) {
    return code
        .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, '')
        .replace(/--[^\n]*/g, '')
        .replace(/^\s+/gm, '')
        .replace(/\n\s*\n+/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function applyControlFlowFlattening(code) {
    const lines = code.split('\n').filter(l => l.trim());
    if (lines.length < 3) return code;
    
    const stateVar = generateObfuscatedId();
    const statesVar = generateObfuscatedId();
    
    let result = `local ${stateVar} = 1\n`;
    result += `local ${statesVar} = {}\n`;
    
    lines.forEach((line, i) => {
        result += `${statesVar}[${i + 1}] = function()\n    ${line}\n    ${stateVar} = ${i + 2}\nend\n`;
    });
    
    result += `${statesVar}[${lines.length + 1}] = function() end\n`;
    result += `while ${stateVar} <= ${lines.length} do\n    ${statesVar}[${stateVar}]()\nend\n`;
    return result;
}

function applyStringEncryption(code) {
    let result = code;
    const stringMap = new Map();
    const decVar = generateObfuscatedId();
    
    result = result.replace(/"((?:\\.|[^"\\])*)"/g, (match, content) => {
        if (!stringMap.has(match)) {
            const key = Math.floor(Math.random() * 255) + 1;
            const encrypted = Array.from(content).map((c, i) => {
                return c.charCodeAt(0) ^ ((key + i) % 256);
            });
            const encStr = encrypted.map(b => '\\' + b.toString(10).padStart(3, '0')).join('');
            stringMap.set(match, { encStr, key });
        }
        const { encStr, key } = stringMap.get(match);
        return `${decVar}("${encStr}", ${key})`;
    });
    
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
        finalSource += `-- Generated by LuaForge Server v3.1\n`;
        finalSource += `-- Timestamp: ${new Date().toISOString()}\n`;
        finalSource += `-- Preset: ${preset || 'Medium'}\n`;
        finalSource += `-- SpecialChars: ${SPECIAL_CHARS}\n`;
        finalSource += `-- RequestID: ${generateUUID()}\n\n`;

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

        switch (preset) {
            case 'Minify':
                obfuscatedCode = applyMinify(obfuscatedCode);
                obfuscatedCode = obfuscateIdentifiers(obfuscatedCode);
                break;
            case 'Weak':
                obfuscatedCode = obfuscateIdentifiers(obfuscatedCode);
                break;
            case 'Medium':
                if (flowFlatten) obfuscatedCode = applyControlFlowFlattening(obfuscatedCode);
                obfuscatedCode = obfuscateIdentifiers(obfuscatedCode);
                break;
            case 'Strong':
            case 'Maximum':
                if (flowFlatten) obfuscatedCode = applyControlFlowFlattening(obfuscatedCode);
                if (stringEncrypt) obfuscatedCode = applyStringEncryption(obfuscatedCode);
                obfuscatedCode = obfuscateIdentifiers(obfuscatedCode);
                break;
            default:
                obfuscatedCode = obfuscateIdentifiers(obfuscatedCode);
        }

        obfuscatedCode += `\n\n--[=[
    END OF OBFUSCATED SCRIPT
    LuaForge Server v3.1 | Special Chars: ${SPECIAL_CHARS}
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
            message: err.message,
            stack: err.stack
        });
    }
};
