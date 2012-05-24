// user-api-test.js
//
// Test the client registration API
//
// Copyright 2012, StatusNet Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var assert = require('assert'),
    vows = require('vows'),
    Step = require('step'),
    _ = require('underscore'),
    querystring = require('querystring'),
    OAuth = require('oauth').OAuth,
    httputil = require('./lib/http');

var suite = vows.describe('user API');

var register = function(cl, params, callback) {
    httputil.postJSON('http://localhost:4815/api/users', 
                      {consumer_key: cl.client_id, consumer_secret: cl.client_secret}, 
                      params,
                      callback);
};

var registerSucceed = function(params) {
    return {
        topic: function(cl) {
            var cb = this.callback,
                resp = function(err, res, body) {
                    var user;
                    if (err) {
                        cb(new Error(err.data), null);
                    } else {
                        try {
                            user = JSON.parse(body);
                            cb(null, user);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                };
            register(cl, params, resp);
        },
        'it works': function(err, user) {
            assert.ifError(err);
            assert.isObject(user);
        },
        'results are correct': function(err, user) {
            assert.include(user, 'nickname');
            assert.include(user, 'published');
            assert.include(user, 'updated');
            assert.include(user, 'profile');
            assert.isObject(user.profile);
            assert.include(user.profile, 'id');
            assert.include(user.profile, 'objectType');
            assert.equal(user.profile.objectType, 'person');
        }
    };
};

var registerFail = function(params) {
    return {
        topic: function(cl) {
            var cb = this.callback,
                resp = function(err, res, body) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                };
            register(cl, params, resp);
        },
        'it fails correctly': function(err) {
            assert.ifError(err);
        }
    };
};

var doubleRegisterSucceed = function(first, second) {
    return {
        topic: function(cl) {
            var user1, user2, cb = this.callback;

            Step(
                function() {
                    register(cl, first, this);
                },
                function(err, res, body) {
                    if (err) throw err;
                    user1 = JSON.parse(body); // may throw
                    register(cl, second, this);
                },
                function(err, res, body) {
                    if (err) throw err;
                    user2 = JSON.parse(body); // may throw
                    this(null);
                },
                function(err) {
                    if (err) {
                        cb(err, null);
                    } else {
                        cb(null, user1, user2);
                    }
                }
            );
        },
        'it works': function(err, user1, user2) {
            assert.ifError(err);
        },
        'user1 is correct': function(err, user1, user2) {
            assert.include(user1, 'nickname');
            assert.include(user1, 'published');
            assert.include(user1, 'updated');
            assert.include(user1, 'profile');
            assert.isObject(user1.profile);
            assert.include(user1.profile, 'id');
            assert.include(user1.profile, 'objectType');
            assert.equal(user1.profile.objectType, 'person');
        },
        'user2 is correct': function(err, user1, user2) {
            assert.include(user2, 'nickname');
            assert.include(user2, 'published');
            assert.include(user2, 'updated');
            assert.include(user2, 'profile');
            assert.isObject(user2.profile);
            assert.include(user2.profile, 'id');
            assert.include(user2.profile, 'objectType');
            assert.equal(user2.profile.objectType, 'person');
        }
    };
};

var doubleRegisterFail = function(first, second) {
    return {
        topic: function(cl) {
            var cb = this.callback;

            Step(
                function() {
                    register(cl, first, this);
                },
                function(err, res, body) {
                    if (err) {
                        cb(new Error(err.data));
                        return;
                    }
                    register(cl, second, this);
                },
                function(err, res, body) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                }
            );
        },
        'it fails correctly': function(err) {
            assert.ifError(err);
        }
    };
};

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            var cb = this.callback,
                config = {port: 4815,
                          hostname: 'localhost',
                          driver: 'memory',
                          params: {},
                          nologger: true
                         },
                makeApp = require('../lib/app').makeApp;

            makeApp(config, function(err, app) {
                if (err) {
                    cb(err, null);
                } else {
                    app.run(function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, app);
                        }
                    });
                }
            });
        },
        teardown: function(app) {
            app.close();
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we check the user list endpoint': {
            topic: function() {
                httputil.options('localhost', 4815, '/api/users', this.callback);
            },
            'it exists': function(err, allow, res, body) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
            },
            'it supports GET': function(err, allow, res, body) {
                assert.include(allow, 'GET');
            },
            'it supports POST': function(err, allow, res, body) {
                assert.include(allow, 'POST');
            }
        },
        'and we try to register a user with no OAuth credentials': {
            topic: function() {
                var cb = this.callback;
                httputil.postJSON('http://localhost:4815/api/users', {}, {nickname: 'nocred', password: 'nobadge'}, function(err, res, body) {
                    if (err && err.statusCode === 401) {
                        cb(null);
                    } else if (err) {
                        cb(err);
                    } else {
                        cb(new Error("Unexpected success"));
                    }
                });
            },
            'it fails correctly': function(err) {
                assert.ifError(err);
            }
        },
        'and we create a client using the api': {
            topic: function() {
                var cb = this.callback;
                httputil.post('localhost', 4815, '/api/client/register', {type: 'client_associate'}, function(err, res, body) {
                    var cl;
                    if (err) {
                        cb(err, null);
                    } else {
                        try {
                            cl = JSON.parse(body);
                            cb(null, cl);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                });
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            'and we register a user with nickname and password': 
            registerSucceed({nickname: 'withcred', password: 'verysecret'}),
            'and we register a user with nickname and no password': 
            registerFail({nickname: 'nopass'}),
            'and we register a user with password and no nickname': 
            registerFail({password: 'toosecret'}),
            'and we register a user with no data': 
            registerFail({}),
            'and we register two unrelated users':
            doubleRegisterSucceed({nickname: "able", password: "isuream"},
                                  {nickname: "baker", password: "flour"}),
            'and we register two users with the same nickname':
            doubleRegisterFail({nickname: "charlie", password: "parker"},
                               {nickname: "charlie", password: "mccarthy"}),
            'and we try to register with URL-encoded params': {
                topic: function(cl) {
                    var oa, toSend, cb = this.callback;

                    oa = new OAuth(null, // request endpoint N/A for 2-legged OAuth
                                   null, // access endpoint N/A for 2-legged OAuth
                                   cl.client_id, 
                                   cl.client_secret, 
                                   "1.0",
                                   null,
                                   "HMAC-SHA1",
                                   null, // nonce size; use default
                                   {"User-Agent": "activitypump-test/0.1.0"});
                    
                    toSend = querystring.stringify({nickname: "delta", password: "dawn"});

                    oa.post('http://localhost:4815/api/users', null, null, toSend, 'application/x-www-form-urlencoded', function(err, data, response) {
                        if (err) {
                            cb(null);
                        } else {
                            cb(new Error("Unexpected success"));
                        }
                    });
                },
                'it fails correctly': function(err) {
                    assert.ifError(err);
                }
            }
        }
    }
});

suite.addBatch({
    'When we set up the app': {
        topic: function() {
            var cb = this.callback,
                config = {port: 4815,
                          hostname: 'localhost',
                          driver: 'memory',
                          params: {},
                          nologger: true
                         },
                makeApp = require('../lib/app').makeApp;

            makeApp(config, function(err, app) {
                if (err) {
                    cb(err, null);
                } else {
                    app.run(function(err) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, app);
                        }
                    });
                }
            });
        },
        teardown: function(app) {
            app.close();
        },
        'it works': function(err, app) {
            assert.ifError(err);
        },
        'and we create a client using the api': {
            topic: function() {
                var cb = this.callback;
                httputil.post('localhost', 4815, '/api/client/register', {type: 'client_associate'}, function(err, res, body) {
                    var cl;
                    if (err) {
                        cb(err, null);
                    } else {
                        try {
                            cl = JSON.parse(body);
                            cb(null, cl);
                        } catch (err) {
                            cb(err, null);
                        }
                    }
                });
            },
            'it works': function(err, cl) {
                assert.ifError(err);
                assert.isObject(cl);
                assert.isString(cl.client_id);
                assert.isString(cl.client_secret);
            },
            'and we get an empty user list': {
                topic: function(cl) {
                    httputil.getJSON('http://localhost:4815/api/users',
                                     {consumer_key: cl.client_id, consumer_secret: cl.client_secret},
                                     this.callback);
                },
                'it works': function(err, collection) {
                    assert.ifError(err);
                },
                'it has the right top-level properties': function(err, collection) {
                    assert.isObject(collection);
                    assert.include(collection, 'displayName');
                    assert.isString(collection.displayName);
                    assert.include(collection, 'id');
                    assert.isString(collection.id);
                    assert.include(collection, 'objectTypes');
                    assert.isArray(collection.objectTypes);
                    assert.length(collection.objectTypes, 1);
                    assert.include(collection.objectTypes, 'user');
                    assert.include(collection, 'totalCount');
                    assert.isNumber(collection.totalCount);
                    assert.include(collection, 'items');
                    assert.isArray(collection.items);
                },
                'it is empty': function(err, collection) {
                    assert.equal(collection.totalCount, 0);
                    assert.isEmpty(collection.items);
                }
            }
        }
    }
});

suite.export(module);