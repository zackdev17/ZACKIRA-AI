/*
 * ZACKIRA AI - WhatsApp bot with AI, made by ZACK
 * (c) 2026 ZACK. Free and open source.
 *
 * Don't sell this script or re-upload it without my permission.
 * If you modify or share it, keep this header and credit me as the original author.
 * Please don't remove or change the watermark.
 */

const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

let clientPromise = null;

async function getDb(uri) {
    if (!clientPromise) {
        const { MongoClient } = require('mongodb');
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
        clientPromise = client.connect().catch((e) => {
            clientPromise = null;
            throw e;
        });
    }
    const client = await clientPromise;
    return client.db(process.env.MONGODB_DB || 'zackira');
}

async function getCollection(uri) {
    return (await getDb(uri)).collection(process.env.MONGODB_COLLECTION || 'wa_session');
}

async function useMongoAuthState(collection) {
    const write = (data, id) =>
        collection.replaceOne({ _id: id }, { data: JSON.stringify(data, BufferJSON.replacer) }, { upsert: true });
    const remove = (id) => collection.deleteOne({ _id: id });
    const read = async (id) => {
        const doc = await collection.findOne({ _id: id });
        return doc ? JSON.parse(doc.data, BufferJSON.reviver) : null;
    };

    const creds = (await read('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await read(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category of Object.keys(data)) {
                        for (const id of Object.keys(data[category])) {
                            const value = data[category][id];
                            const name = `${category}-${id}`;
                            tasks.push(value ? write(value, name) : remove(name));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: () => write(creds, 'creds'),
        clear: () => collection.deleteMany({}),
    };
}

module.exports = { useMongoAuthState, getCollection, getDb };
