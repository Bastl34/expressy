const fs = require('fs');

const express = require('express');
const proxy = require('express-http-proxy');
const serveIndex = require('serve-index');
const micromatch = require('micromatch');
const dateFormat = require('dateformat');

const HOST_TYPE =
{
    static: 1,
    proxy: 2,
    alias: 3,
    redirect: 4
};

const LOG_TYPE =
{
    sys: "sys",
    access: "access",
    error: "error"
}

const CONFIG_FILE = './config.json';
const LOG_PATH = './logs/';

let hosts = {};
let hostKeys = [];
let config = {};

// ******************** logging ********************
function log(type, message)
{
    let date = dateFormat(Date(), "yyyy-mm-dd dd:MM:ss");
    message = date + ': ' + message + '\n';

    process.stdout.write(message);

    fs.appendFile(LOG_PATH + type + '.log',message, 'utf8', (error) =>
    {
        if (error)
            console.error(error)
    });
}

const logging =
{
    log: (message) => { log('sys', message) },
    error: (message) => { log('error', message) },
    access: (message) => { log('access', message) },
}

// ******************** helpers ********************
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
                logging.log(hosts[hostKey].domain + ' alias resolved to ' + resolvedHost.domain)
                hosts[hostKey] = resolvedHost;
            }
        }
        else
            logging.log(hosts[hostKey].domain + ' listening on port ' + conf.port  + '...');
    }

    hostKeys = Object.keys(hosts);
    logging.log('domains: '+hostKeys);

    return conf;
}

// ******************** load config ********************

logging.log('start.. ');

config = loadConfig(loadJSONfromFile(CONFIG_FILE));
if (config.watchConfig)
{
    fs.watchFile(CONFIG_FILE, (curr, prev) =>
    {
        logging.log('reloading config...');
        sysLogger.info({message: 'listening on '+config.port});

        let json = loadJSONfromFile(CONFIG_FILE);
        if (!json)
            logging.error('can not reload json - parse error')
        else
            config = loadConfig(json);
    });
}

logging.log('listening on '+config.port);


// ******************** listen ********************
express().use((req, res, next) =>
{
    logging.access('[' + req.connection.remoteAddress + '] ' + '[' + req.method + '] ' + req.protocol + '://' + req.hostname + req.originalUrl);

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