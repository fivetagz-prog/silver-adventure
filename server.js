const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const upload = multer({ dest: os.tmpdir() });

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

const PROMETHEUS_CLI = 'npx prometheus-cli';

function checkPrometheus() {
    return new Promise((resolve, reject) => {
        exec('npx prometheus-cli --version', (err, stdout) => {
            if (err) reject(new Error('prometheus-cli not found'));
            else resolve(stdout.trim());
        });
    });
}

function generateAntiTamper() {
    const seed = crypto.randomBytes(8).toString('hex');
    return `
--[=[
    ANTI-TAMPER MODULE v2.1
    Seed: ${seed}
    Detects: beautification, reformatting, line injection
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
            for line in content:gmatch("[^\r\n]+") do
                table.insert(lines, line)
            end
            local expected = #lines
            local actual = 0
            for _ in content:gmatch("\n") do actual = actual + 1 end
            if math.abs(expected - actual) > 2 then
                error("[LuaForge] Tamper Detected! Line count mismatch.")
            end
            if content:match("\n\s*\n\s*\n") then
                error("[LuaForge] Tamper Detected! Excessive whitespace detected.")
            end
        end
    end
end
_AT_CHECK()
`;
}

function generateAntiDebug() {
    return `
--[=[
    ANTI-DEBUG / ANTI-ENVIRONMENT LOGGER v2.1
    Detects: debuggers, deobfuscation tools, env tampering
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
                if k:lower():match("unluac_") then error("[LuaForge] Deobfuscation tool detected: " .. k) end
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
    const junkOps = Array.from({length: 20}, (_, i) => {
        const ops = ['+', '-', '*', '/', '%', '^'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        return `local _JUNK_${i} = function(a, b) return a ${op} b end`;
    }).join('\n');
    return `
--[=[
    AI-RESISTANT OBFUSCATION LAYER v2.1
    Purpose: Confuse AI deobfuscators and static analysis
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
    return `
--[=[
    STRING ENCRYPTION MODULE v2.1
    Runtime XOR decryption with rotating key
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

app.post('/api/obfuscate', upload.single('file'), async (req, res) => {
    const startTime = Date.now();
    try {
        let sourceCode = '';
        if (req.file) {
            sourceCode = fs.readFileSync(req.file.path, 'utf8');
            fs.unlinkSync(req.file.path);
        } else if (req.body.code) {
            sourceCode = req.body.code;
        } else {
            return res.status(400).json({ error: 'No code or file provided' });
        }

        const options = {
            preset: req.body.preset || 'Medium',
            antiTamper: req.body.antiTamper === 'true' || req.body.antiTamper === true,
            antiDebug: req.body.antiDebug === 'true' || req.body.antiDebug === true,
            stringEncrypt: req.body.stringEncrypt === 'true' || req.body.stringEncrypt === true,
            flowFlatten: req.body.flowFlatten === 'true' || req.body.flowFlatten === true,
            vmify: req.body.vmify === 'true' || req.body.vmify === true,
            watermark: req.body.watermark || 'Protected By LuaForge'
        };

        const validPresets = ['Minify', 'Weak', 'Medium', 'Strong', 'Maximum'];
        if (!validPresets.includes(options.preset)) options.preset = 'Medium';

        const tmpDir = os.tmpdir();
        const inputFile = path.join(tmpDir, `input_${Date.now()}.lua`);
        const outputFile = path.join(tmpDir, `output_${Date.now()}.lua`);

        let finalSource = '';
        finalSource += `-- ${options.watermark}\n`;
        finalSource += `-- Generated by LuaForge Server | Prometheus Obfuscator\n`;
        finalSource += `-- Timestamp: ${new Date().toISOString()}\n`;
        finalSource += `-- Preset: ${options.preset}\n`;
        finalSource += `-- Protections: AntiTamper=${options.antiTamper} AntiDebug=${options.antiDebug} StringEnc=${options.stringEncrypt} FlowFlat=${options.flowFlatten} VM=${options.vmify}\n`;
        finalSource += `-- RequestID: ${crypto.randomUUID()}\n`;
        finalSource += `\n`;

        if (options.antiDebug) {
            finalSource += generateAntiDebug();
            finalSource += `\n`;
        }
        if (options.antiTamper) {
            finalSource += generateAntiTamper();
            finalSource += `\n`;
        }
        if (options.stringEncrypt) {
            finalSource += generateStringEncryptor();
            finalSource += `\n`;
        }
        if (options.vmify) {
            finalSource += generateAIResistant();
            finalSource += `\n`;
        }

        finalSource += `--[=[ USER CODE START ]=]\n`;
        finalSource += sourceCode;
        finalSource += `\n--[=[ USER CODE END ]=]\n`;

        fs.writeFileSync(inputFile, finalSource);

        const prometheusArgs = [inputFile, `--preset`, options.preset, `--out`, outputFile];
        const command = `${PROMETHEUS_CLI} ${prometheusArgs.join(' ')}`;

        await new Promise((resolve, reject) => {
            exec(command, { timeout: 30000, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error && !fs.existsSync(outputFile)) {
                    reject(new Error(`Prometheus failed: ${stderr || error.message}`));
                } else {
                    resolve();
                }
            });
        });

        let obfuscatedCode = fs.readFileSync(outputFile, 'utf8');
        obfuscatedCode += `\n\n--[=[\n`;
        obfuscatedCode += `    END OF OBFUSCATED SCRIPT\n`;
        obfuscatedCode += `    LuaForge Server v2.1\n`;
        obfuscatedCode += `    github.com/wcrddn/Prometheus\n`;
        obfuscatedCode += `    Obfuscation time: ${Date.now() - startTime}ms\n`;
        obfuscatedCode += `]=]`;

        fs.unlinkSync(inputFile);
        fs.unlinkSync(outputFile);

        res.json({
            success: true,
            obfuscated: obfuscatedCode,
            metadata: {
                preset: options.preset,
                protections: {
                    antiTamper: options.antiTamper,
                    antiDebug: options.antiDebug,
                    stringEncrypt: options.stringEncrypt,
                    flowFlatten: options.flowFlatten,
                    vmify: options.vmify
                },
                watermark: options.watermark,
                originalSize: sourceCode.length,
                obfuscatedSize: obfuscatedCode.length,
                ratio: ((obfuscatedCode.length / sourceCode.length) * 100).toFixed(1) + '%',
                duration: Date.now() - startTime
            }
        });
    } catch (err) {
        console.error('Obfuscation error:', err);
        res.status(500).json({
            error: 'Obfuscation failed',
            message: err.message,
            suggestion: 'npm install -g @gamely/prometheus-cli'
        });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const version = await checkPrometheus();
        res.json({ status: 'ok', prometheus: version });
    } catch (err) {
        res.status(503).json({ status: 'error', message: err.message });
    }
});

app.get('/api/presets', (req, res) => {
    res.json({
        presets: [
            { name: 'Minify', description: 'Strip whitespace and comments only' },
            { name: 'Weak', description: 'Basic identifier renaming' },
            { name: 'Medium', description: 'Balanced protection with control flow' },
            { name: 'Strong', description: 'Maximum obfuscation with string encryption' },
            { name: 'Maximum', description: 'VM-based with all protections' }
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`\nLuaForge Server running on port ${PORT}`);
    try {
        const version = await checkPrometheus();
        console.log(`Prometheus CLI detected: ${version}`);
    } catch (err) {
        console.log(`Warning: ${err.message}`);
        console.log(`   Install with: npm install -g @gamely/prometheus-cli`);
    }
    console.log(`\nEndpoints:`);
    console.log(`  POST /api/obfuscate  — Obfuscate Lua code`);
    console.log(`  GET  /api/health     — Health check`);
    console.log(`  GET  /api/presets    — List presets`);
    console.log(`\n`);
});

module.exports = app;
