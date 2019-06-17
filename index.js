const fs = require('fs');

const express = require('express');
const proxy = require('express-http-proxy');
const serveIndex = require('serve-index');
const micromatch = require('micromatch');

const HOST_TYPE =
{
    static: 1,
    proxy: 2,
    alias: 3,
    redirect: 4
};

const CONFIG_FILE = './config.json';

let hosts = {};
let hostKeys = [];
let config = {};

// helpers
function loadJSONfromFile(file)
{
    try
    {
        return JSON.parse(fs.readFileSync(file));
    }
    catch(error)
    {
        console.error(error);
        return null;
    }
}

function resolveHost(host, depth=1, maxDepth=5)
{
    if (depth >= maxDepth)
        return null;

    if (host.target in hosts)
    {
        if (hosts[host.target].type == HOST_TYPE.alias)
            return resolveHost(hosts[host.target], ++depth, maxDepth);
        else
            return hosts[host.target];
    }
    return null;
}

function loadConfig(json)
{
    conf = json;

    // config
    hosts = {};
    conf.hosts.forEach(host =>
    {
        if (host.type == 'proxy')
            host.type = HOST_TYPE.proxy;
        else if (host.type == 'alias')
            host.type = HOST_TYPE.alias;
        else if (host.type == 'redirect')
            host.type = HOST_TYPE.redirect;
        else
            host.type = HOST_TYPE.static;

        hosts[host.domain] = host;
    });

    for(let hostKey in hosts)
    {
        if (hosts[hostKey].type == HOST_TYPE.alias)
        {
            let resolvedHost = resolveHost(hosts[hostKey]);
            if (resolvedHost)
            {
                console.log(hosts[hostKey].domain + ' alias resolved to ' + resolvedHost.domain)
                hosts[hostKey] = resolvedHost;
            }
        }
        else
            console.log(hosts[hostKey].domain + ' listening on port ' + conf.port  + '...');
    }

    hostKeys = Object.keys(hosts);

    console.log(hostKeys);

    return conf;
}

// load config
config = loadConfig(loadJSONfromFile(CONFIG_FILE));
if (config.watchConfig)
{
    fs.watchFile(CONFIG_FILE, (curr, prev) =>
    {
        console.log('reloading config...');

        let json = loadJSONfromFile(CONFIG_FILE);
        if (!json)
            console.error('can not reload json - parse error')
        else
            config = loadConfig(json);
    });
}


// listen
express().use((req, res, next) =>
{
    //check host
    let host = hosts[req.hostname] || null;
    if (!host)
    {
        //go through all domains
        for(let domain in hosts)
        {
            if (micromatch.isMatch(req.hostname, domain))
            {
                host = hosts[domain];
                break;
            }
        }
    }

    if (!host)
        return res.status(404).send('not found');

    if (host.type == HOST_TYPE.alias)
        return res.status(500).send('alias cannot be resolved');

    if (host.type == HOST_TYPE.static && !host.index)
        return express.static(host.target)(req, res, next);
    else if (host.type == HOST_TYPE.static && host.index)
        return serveIndex(host.target, {'icons': true, 'view': 'details'})(req, res, () => { return express.static(host.target)(req, res, next) });
    else if (host.type == HOST_TYPE.proxy)
        return proxy(host.target)(req, res, next);
    else if (host.type == HOST_TYPE.redirect)
        return res.redirect(host.target);

    return res.status(500).send('server error');

}).listen(config.port);