import Retell from 'retell-sdk';

const client = new Retell({
    apiKey: process.env['key_65e7c858474bcb14a2d88d9a2d31'], // This is the default and can be omitted
});

const voiceResponses = await client.voice.list();

console.log(voiceResponses);