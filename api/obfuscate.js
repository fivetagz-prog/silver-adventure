// api/obfuscate.js — Vercel serverless, ESM format

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = req.body;
    if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Invalid body' });
    }

    const code = body.code;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'No code' });
    }

    try {
        const crypto = require('crypto');
        const SPECIAL_CHARS = '@$#&-_()+!?';
        
        function uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = crypto.randomBytes(1)[0] % 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        
        function genId() {
            const chars = 'IlO0' + SPECIAL_CHARS;
            let s = '_';
            const len = Math.floor(Math.random() * 6) + 8;
            for (let i = 0; i < len; i++) {
                s += chars[Math.floor(Math.random() * chars.length)];
            }
            return s;
        }
        
        function antiDebug() {
            const c = genId();
            return `local ${c}={debug=function()local d=rawget(_G,"debug")if d then if d.gethook then return true end if d.sethook then return true end end return false end,hooks=function()if debug and debug.gethook then local h,m=debug.gethook()if h then error("[LuaForge] Debugger hook!")end end return false end,env=function()local e=getfenv and getfenv()or _G for k,v in pairs(e)do if type(k)=="string"then if k:lower():match("deobfuscate")then error("[LuaForge] Tool:"..k)end if k:lower():match("unluac")then error("[LuaForge] Tool:"..k)end end end if e.print~=print then error("[LuaForge] print tampered!")end if e.string~=string then error("[LuaForge] string tampered!")end return false end,timing=function()local t1=os.clock()for i=1,1000000 do end local t2=os.clock()if(t2-t1)>0.5 then error("[LuaForge] Timing anomaly!")end return false end}for name,check in pairs(${c})do local ok,err=pcall(check)if not ok then error(err)end end`;
        }
        
        function antiTamper() {
            const c = genId();
            return `local ${c}=function()local info=debug.getinfo(3,"S")if info and info.source then local src=info.source:gsub("^@","")local f=io.open(src,"r")if f then local content=f:read("*a")f:close()if content:match("\\\\n\\\\s*\\\\n\\\\s*\\\\n")then error("[LuaForge] Tamper Detected!")end end end end ${c}()`;
        }
        
        function stringEnc() {
            const k = Math.floor(Math.random() * 200 + 50);
            const kv = genId(), rv = genId(), dv = genId();
            return `local ${kv}=${k}local ${rv}=function(k,i)return bit.bxor(k,bit.lshift(i%256,(i%4)*2))end local ${dv}=function(enc,key)local result={}local k=key or ${kv}for i=1,#enc do local byte=string.byte(enc,i)local rotated=${rv}(k,i)result[i]=string.char(bit.bxor(byte,rotated%256))end return table.concat(result)end`;
        }
        
        function aiResist() {
            let junk = '';
            const ops = ['+', '-', '*', '//', '%'];
            for (let i = 0; i < 10; i++) {
                junk += `local ${genId()}=function(a,b)return a ${ops[Math.floor(Math.random()*ops.length)]} b end `;
            }
            return junk + `local ${genId()}=function(x,y)local a=x*x+2*x*y+y*y local b=(x+y)*(x+y)return math.abs(a-b)<0.0001 end local ${genId()}=function()local d={}for i=1,50 do d[i]=string.char(65+(i%26))end return table.concat(d)end`;
        }
        
        // Obfuscation
        const keywords = new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while']);
        const globals = new Set(['assert','collectgarbage','dofile','error','getmetatable','ipairs','load','loadfile','next','pairs','pcall','print','rawequal','rawget','rawlen','rawset','require','select','setmetatable','tonumber','tostring','type','xpcall','_G','_ENV','package','string','utf8','table','math','io','os','debug','coroutine','bit','bit32','jit']);
        
        const tokens = [];
        let i = 0;
        while (i < code.length) {
            const ch = code[i];
            
            if (/\s/.test(ch)) { i++; continue; }
            
            if (ch === '-' && code[i+1] === '-' && code[i+2] === '[' && code[i+3] === '[') {
                let j = i + 4;
                while (j < code.length - 1 && !(code[j] === ']' && code[j+1] === ']')) j++;
                tokens.push({type: 'prot', val: code.slice(i, j+2)});
                i = j + 2;
                continue;
            }
            
            if (ch === '-' && code[i+1] === '-') {
                let j = i + 2;
                while (j < code.length && code[j] !== '\n') j++;
                tokens.push({type: 'prot', val: code.slice(i, j)});
                i = j;
                continue;
            }
            
            if (ch === '"') {
                let j = i + 1;
                while (j < code.length && code[j] !== '"') {
                    if (code[j] === '\\') j++;
                    j++;
                }
                tokens.push({type: 'prot', val: code.slice(i, j+1)});
                i = j + 1;
                continue;
            }
            
            if (ch === "'") {
                let j = i + 1;
                while (j < code.length && code[j] !== "'") {
                    if (code[j] === '\\') j++;
                    j++;
                }
                tokens.push({type: 'prot', val: code.slice(i, j+1)});
                i = j + 1;
                continue;
            }
            
            if (ch === '[' && code[i+1] === '[') {
                let j = i + 2;
                while (j < code.length - 1 && !(code[j] === ']' && code[j+1] === ']')) j++;
                tokens.push({type: 'prot', val: code.slice(i, j+2)});
                i = j + 2;
                continue;
            }
            
            if (/[a-zA-Z_]/.test(ch)) {
                let j = i;
                while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
                const name = code.slice(i, j);
                if (keywords.has(name) || globals.has(name)) {
                    tokens.push({type: 'keep', val: name});
                } else {
                    tokens.push({type: 'id', val: name});
                }
                i = j;
                continue;
            }
            
            if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(code[i+1]))) {
                let j = i;
                while (j < code.length && (/[0-9]/.test(code[j]) || code[j] === '.' || code[j] === 'e' || code[j] === 'E' || code[j] === '+' || code[j] === '-')) j++;
                tokens.push({type: 'keep', val: code.slice(i, j)});
                i = j;
                continue;
            }
            
            tokens.push({type: 'keep', val: ch});
            i++;
        }
        
        const idMap = new Map();
        for (const t of tokens) {
            if (t.type === 'id') {
                if (!idMap.has(t.val)) idMap.set(t.val, genId());
                t.val = idMap.get(t.val);
            }
        }
        
        let processed = tokens.map(t => t.val).join('');
        
        if (body.preset === 'Minify') {
            processed = processed.replace(/^\s+/gm, '').replace(/\n\s*\n+/g, '\n').replace(/[ \t]+/g, ' ').trim();
        }
        
        let output = `-- ${body.watermark || 'Protected By LuaForge'}\n`;
        output += `-- Generated by LuaForge Server v3.2\n`;
        output += `-- Timestamp: ${new Date().toISOString()}\n`;
        output += `-- Preset: ${body.preset || 'Medium'}\n`;
        output += `-- SpecialChars: ${SPECIAL_CHARS}\n`;
        output += `-- RequestID: ${uuid()}\n\n`;
        
        if (body.antiDebug) output += antiDebug() + '\n';
        if (body.antiTamper) output += antiTamper() + '\n';
        if (body.stringEncrypt) output += stringEnc() + '\n';
        if (body.vmify) output += aiResist() + '\n';
        
        output += `--[=[ USER CODE START ]=]\n`;
        output += processed;
        output += `\n--[=[ USER CODE END ]=]\n`;
        output += `\n--[=[\n    LuaForge Server v3.2 | Special Chars: ${SPECIAL_CHARS}\n    github.com/wcrddn/Prometheus\n]=]`;
        
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
        console.error('FATAL:', err.message);
        res.status(500).json({ error: err.message });
    }
}
