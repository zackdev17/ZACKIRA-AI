/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const crypto = require('crypto');

const stringifyEscaped = (obj) =>
    JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const DEFAULT_BOT_JID = '867051314767696@bot';
const FORWARD_ORIGIN_META_AI = 4;
const BOT_ENTRY_POINT_META_AI_FORWARD = 31;

function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
    if (!extract) {
        return { text, ie: [] };
    }
    let ie = [],
        result = '',
        last = 0,
        citation_index = 1,
        hyperlink_index = 0,
        latex_index = 0,
        stack = [];
        
    for (let i = 0; i < text.length; i++) {
        if (text[i] == '[' && text[i - 1] != '\\') {
            stack.push(i);
        } else if (text[i] == ']' && (text[i + 1] == '(' || text[i + 1] == '<')) {
            let start = stack.pop();
            if (start == null) continue;
            let open = text[i + 1],
                close = open == '(' ? ')' : '>',
                type = open == '(' ? 'link' : 'latex',
                end = i + 2,
                depth = 1;
                
            while (end < text.length && depth) {
                if (text[end] == open && text[end - 1] != '\\') depth++;
                else if (text[end] == close && text[end - 1] != '\\') depth--;
                end++;
            }
            if (depth) continue;
            
            let raw = text.slice(start + 1, i).trim(),
                url = text.slice(i + 2, end - 1).trim(),
                key, tag, data;
                
            if (type == 'latex') {
                if (!latex) continue;
                let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');
                key = `\u004E\u0049\u0058\u0045\u004C_LATEX_${latex_index++}`;
                tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;
                data = {
                    type: 'latex',
                    ie: { key, text: txt, url, width, height, font_height, padding },
                };
            } else if (raw) {
                if (!hyperlink) continue;
                key = `\u004E\u0049\u0058\u0045\u004C_HYPERLINK_${hyperlink_index++}`;
                tag = `{{${key}}}${url}{{/${key}}}`;
                data = {
                    type: 'hyperlink',
                    ie: { key, text: raw, url },
                };
            } else {
                if (!citation) continue;
                key = `\u004E\u0049\u0058\u0045\u004C_CITATION_${citation_index - 1}`;
                tag = `{{${key}}}${url}{{/${key}}}`;
                data = {
                    type: 'citation',
                    ie: { reference_id: citation_index++, key, text: '', url },
                };
            }
            result += text.slice(last, start) + tag;
            last = end;
            ie.push(data);
            i = end - 1;
        }
    }
    result += text.slice(last);
    return { text: result, ie };
}

class BaseBuilder {
    constructor() {
        this._title = '';
        this._subtitle = '';
        this._body = '';
        this._footer = '';
        this._contextInfo = {};
        this._extraPayload = {};
    }

    setTitle(title) {
        if (typeof title !== 'string') throw new TypeError('Title must be a string');
        this._title = title;
        return this;
    }

    setSubtitle(subtitle) {
        if (typeof subtitle !== 'string') throw new TypeError('Subtitle must be a string');
        this._subtitle = subtitle;
        return this;
    }

    setBody(body) {
        if (typeof body !== 'string') throw new TypeError('Body must be a string');
        this._body = body;
        return this;
    }

    setFooter(footer) {
        if (typeof footer !== 'string') throw new TypeError('Footer must be a string');
        this._footer = footer;
        return this;
    }

    setContextInfo(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('ContextInfo must be a plain object');
        }
        this._contextInfo = obj;
        return this;
    }

    addPayload(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Payload must be a plain object');
        }
        Object.assign(this._extraPayload, obj);
        return this;
    }
}

class AIRich extends BaseBuilder {
    #client;

    constructor(client) {
        if (!client) throw new Error('Socket is required');
        super();
        this.#client = client;
        this._contextInfo = {};
        this._submessages = [];
        this._sections = [];
        this._richResponseSources = [];
    }

    static newLayout(name, data) {
        return {
            view_model: {
                [Array.isArray(data) ? 'primitives' : 'primitive']: data,
                __typename: `GenAI${name}LayoutViewModel`,
            },
        };
    }

    addSubmessage(submessage) {
        const items = Array.isArray(submessage) ? submessage : [submessage];
        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new TypeError('Submessage must be a plain object or array of plain objects');
            }
            this._submessages.push(item);
        }
        return this;
    }

    addSection(section) {
        const items = Array.isArray(section) ? section : [section];
        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new TypeError('Section must be a plain object or array of plain objects');
            }
            this._sections.push(item);
        }
        return this;
    }

    addText(text, { hyperlink = true, citation = true, latex = true } = {}) {
        if (typeof text != 'string') throw new TypeError('Text must be a string');
        
        const extractedIE = extractIE(text, { hyperlink, citation, latex });
        const inline_entities = extractedIE.ie.map(({ type, ie }) => {
            if (type == 'hyperlink') {
                return {
                    key: ie.key,
                    metadata: {
                        display_name: ie.text,
                        is_trusted: true,
                        url: ie.url,
                        __typename: 'GenAIInlineLinkItem',
                    },
                };
            }
            if (type == 'citation') {
                return {
                    key: ie.key,
                    metadata: {
                        reference_id: ie.reference_id,
                        reference_url: ie.url,
                        reference_title: ie.url,
                        reference_display_name: ie.url,
                        sources: [],
                        __typename: 'GenAISearchCitationItem',
                    },
                };
            }
            return {
                key: ie.key,
                metadata: {
                    latex_expression: ie.text,
                    latex_image: {
                        url: ie.url,
                        width: Number(ie.width) || 100,
                        height: Number(ie.height) || 100,
                    },
                    font_height: Number(ie.font_height) || 83.333333333333,
                    padding: Number(ie.padding) || 15,
                    __typename: 'GenAILatexItem',
                },
            };
        });

        this._submessages.push({
            messageType: 2,
            messageText: extractedIE.text,
        });

        this._sections.push(
            AIRich.newLayout('Single', {
                text: extractedIE.text,
                ...(inline_entities.length && { inline_entities }),
                __typename: 'GenAIMarkdownTextUXPrimitive',
            })
        );
        return this;
    }

    addCode(language, code) {
        if (typeof language !== 'string' || typeof code !== 'string') {
            throw new TypeError('Language and code must be a string');
        }
        const meta = AIRich.tokenizer(code, language);
        this._submessages.push({
            messageType: 5,
            codeMetadata: {
                codeLanguage: language,
                codeBlocks: meta.codeBlock,
            },
        });
        this._sections.push(
            AIRich.newLayout('Single', {
                language,
                code_blocks: meta.unified_codeBlock,
                __typename: 'GenAICodeUXPrimitive',
            })
        );
        return this;
    }

    addTable(table) {
        if (!Array.isArray(table)) throw new TypeError('Table must be an array');
        
        const meta = AIRich.toTableMetadata(table);
        this._submessages.push({
            messageType: 4,
            tableMetadata: {
                title: meta.title,
                rows: meta.rows,
            },
        });
        this._sections.push(
            AIRich.newLayout('Single', {
                rows: meta.unified_rows,
                __typename: 'GenATableUXPrimitive',
            })
        );
        return this;
    }

    build({ forwarded = true, includesUnifiedResponse = true, includesSubmessages = true, botJid = DEFAULT_BOT_JID, quoted, quotedParticipant, ...options } = {}) {
        const forward = forwarded ? {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid },
            forwardOrigin: FORWARD_ORIGIN_META_AI,
            botMessageSharingInfo: {
                botEntryPointOrigin: BOT_ENTRY_POINT_META_AI_FORWARD,
                forwardScore: 1,
            },
        } : {};

        const qObj = quoted ? {
            stanzaId: quoted?.key?.id || quoted?.id,
            participant: quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid,
            quotedType: 0,
            quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined,
        } : {};

        const sections = this._footer ? [
            ...this._sections,
            AIRich.newLayout('Single', {
                text: this._footer,
                __typename: 'GenAIMetadataTextPrimitive',
            }),
        ] : [...this._sections];

        return {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: {
                    botResponseId: crypto.randomUUID(),
                    messageDisclaimerText: this._title,
                    richResponseSourcesMetadata: { sources: this._richResponseSources },
                },
            },
            ...this._extraPayload,
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: includesSubmessages ? this._submessages : [],
                        unifiedResponse: {
                            data: includesUnifiedResponse ? Buffer.from(stringifyEscaped({ response_id: crypto.randomUUID(), sections })).toString('base64') : '',
                        },
                        contextInfo: {
                            ...forward,
                            ...qObj,
                            ...this._contextInfo,
                        },
                    },
                },
            },
        };
    }

    async send(jid, { forwarded, includesUnifiedResponse, includesSubmessages, botJid, bypassDownload = true, quoted, quotedParticipant, ...relayOptions } = {}) {
        if (!this._sections.length) throw new Error('AIRich kosong: tidak ada section untuk dikirim');
        const { generateMessageIDV2 } = require('@whiskeysockets/baileys');
        const selfId = this.#client.user?.id;

        const msg = this.build({ forwarded, includesUnifiedResponse, includesSubmessages, botJid, quoted, quotedParticipant });
        const messageId = relayOptions.messageId || generateMessageIDV2(selfId);

        await this.#client.relayMessage(jid, msg, { ...relayOptions, messageId });

        if (bypassDownload && includesUnifiedResponse !== false) {
            const edit = {
                botForwardedMessage: {
                    message: {
                        protocolMessage: {
                            key: { remoteJid: jid, fromMe: true, id: messageId },
                            type: 14,
                            editedMessage: msg,
                        },
                    },
                },
            };
            try {
                await this.#client.relayMessage(jid, edit, { messageId: generateMessageIDV2(selfId) });
            } catch (error) {
                error.relayedKey = { remoteJid: jid, fromMe: true, id: messageId };
                throw error;
            }
        }
        this._lastMessageKey = { remoteJid: jid, fromMe: true, id: messageId };
        return this._lastMessageKey;
    }

    static tokenizer(code, lang = 'javascript') {
        const keywordsMap = {
            javascript: new Set([
                'break', 'case', 'catch', 'continue', 'debugger', 'delete', 'do', 'else',
                'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return',
                'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
                'with', 'true', 'false', 'null', 'undefined', 'class', 'const', 'let',
                'super', 'extends', 'export', 'import', 'yield', 'static', 'constructor',
                'async', 'await', 'get', 'set'
            ]),
            html: new Set(['html', 'body', 'div', 'span', 'script', 'style', 'a', 'p']),
            css: new Set(['color', 'background', 'margin', 'padding', 'width', 'height'])
        };
        const TYPE_MAP = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' };
        const keywords = keywordsMap[lang] || new Set();
        const tokens = [];
        let i = 0;
        
        const push = (content, type) => {
            if (!content) return;
            const last = tokens[tokens.length - 1];
            if (last && last.highlightType === type) last.codeContent += content;
            else tokens.push({ codeContent: content, highlightType: type });
        };
        
        while (i < code.length) {
            const c = code[i];
            if (/\s/.test(c)) {
                let s = i;
                while (i < code.length && /\s/.test(code[i])) i++;
                push(code.slice(s, i), 0);
                continue;
            }
            if (c === '/' && code[i + 1] === '/') {
                let s = i;
                i += 2;
                while (i < code.length && code[i] !== '\n') i++;
                push(code.slice(s, i), 5);
                continue;
            }
            if (c === '"' || c === "'" || c === '`') {
                let s = i;
                const q = c;
                i++;
                while (i < code.length) {
                    if (code[i] === '\\' && i + 1 < code.length) i += 2;
                    else if (code[i] === q) { i++; break; } 
                    else i++;
                }
                push(code.slice(s, i), 3);
                continue;
            }
            if (/[0-9]/.test(c)) {
                let s = i;
                while (i < code.length && /[0-9.]/.test(code[i])) i++;
                push(code.slice(s, i), 4);
                continue;
            }
            if (/[a-zA-Z_$]/.test(c)) {
                let s = i;
                while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
                const word = code.slice(s, i);
                let type = 0;
                if (keywords.has(word)) type = 1;
                else {
                    let j = i;
                    while (j < code.length && /\s/.test(code[j])) j++;
                    if (code[j] === '(') type = 2;
                }
                push(word, type);
                continue;
            }
            push(c, 0);
            i++;
        }
        
        return {
            codeBlock: tokens,
            unified_codeBlock: tokens.map((t) => ({
                content: t.codeContent,
                type: TYPE_MAP[t.highlightType],
            })),
        };
    }

    static toTableMetadata(arr) {
        if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) {
            throw new TypeError('Table must be a nested array of strings');
        }
        const [header, ...rows] = arr;
        const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
        const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];
        const unified_rows = [
            { is_header: true, cells: normalize(header) },
            ...rows.map((r) => ({ is_header: false, cells: normalize(r) })),
        ];
        const rowsMeta = unified_rows.map((r) => ({
            items: r.cells,
            ...(r.is_header ? { isHeading: true } : {}),
        }));
        
        return {
            title: '',
            rows: rowsMeta,
            unified_rows,
        };
    }
}

module.exports = { AIRich };