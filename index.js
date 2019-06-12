const express = require('express');
const proxy = require('express-http-proxy');

const config = require('./config.json');

const HOST_TYPE =
{
    static: 1,
    proxy: 2,
    alias: 3,
    redirect: 4
};

const hosts = {};

// config
config.hosts.forEach(host =>
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

// resolve aliases
const resolveHost = (host, depth=1, maxDepth=5) =>
{
    if (depth >= maxDepth)
        return null;

    if (host.source in hosts)
    {
        if (hosts[host.source].type == HOST_TYPE.alias)
            return resolveHost(hosts[host.source], ++depth, maxDepth);
        else
            return hosts[host.source];
    }
    return null;
}

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
        console.log(hosts[hostKey].domain + ' listening on port ' + config.port  + '...');
}


// listen
express().use((req, res, next) =>
{
    if (!(req.hostname in hosts))
        return res.status(404).send('not found');

    const host = hosts[req.hostname];

    if (host.type == HOST_TYPE.alias)
        return res.status(500).send('alias cannot be resolved');

    if (host.type == HOST_TYPE.static)
        return express.static(host.source)(req, res, next);
    else if (host.type == HOST_TYPE.proxy)
        return proxy(host.source)(req, res, next);
    else if (host.type == HOST_TYPE.redirect)
        return res.redirect(host.source)
    else
        return res.status(500).send('server error');

}).listen(config.port);