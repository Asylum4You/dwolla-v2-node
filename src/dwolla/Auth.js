var fetch = require('node-fetch');
var formurlencoded = require('form-urlencoded');
var assign = require('lodash/assign');
var invariant = require('invariant');
var rejectEmptyKeys = require('../util/rejectEmptyKeys');
var toJson = require('../util/toJson');

fetch.Promise = require('bluebird');

function handleTokenResponse(client, res) {
  if (res.error) {
    throw res;
  } else {
    return new client.Token(res);
  }
}

function requestToken(client, params) {
  return fetch(client.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: formurlencoded(
      assign({
        client_id: client.id,
        client_secret: client.secret,
      }, params)
    ),
  })
    .then(toJson)
    .then(handleTokenResponse.bind(null, client));
}

function refreshGrant(client, token) {
  return requestToken(client, {
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
  });
}

function query(client, opts) {
  return formurlencoded(
    rejectEmptyKeys({
      response_type: 'code',
      client_id: client.id,
      redirect_uri: opts.redirect_uri,
      scope: opts.scope,
      state: opts.state,
    })
  );
}

function AuthClass(client, opts) {
  if (typeof opts === 'undefined') {
    opts = {};
  }
  this.client = client;
  this.redirect_uri = opts.redirect_uri;
  this.scope = opts.scope;
  this.state = opts.state;
  this.url = [client.authUrl, query(client, opts)].join('?');
}

AuthClass.prototype.callback = function(params) {
  invariant(params.state === this.state, 'Invalid state parameter.');
  if (params.error) {
    throw params;
  }
  return requestToken(
    this.client,
    {
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: this.redirect_uri,
    }
  );
};

module.exports = function(client) {
  return {
    klass: AuthClass.bind(null, client),
    methods: {
      client: requestToken.bind(null, client, {
        grant_type: 'client_credentials',
      }),
      refresh: refreshGrant.bind(null, client),
    },
  };
};