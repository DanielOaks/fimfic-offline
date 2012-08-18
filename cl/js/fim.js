/* FIMFiction Offline Reader
**  Basically, downloads every story in the user's Read Later list
**  to localStorage. The fimfic class below basically creates a nice
**  little class to abstract all that out.
**
**  Now, it doesn't work with normal browsers yet, since we're not
**  allowed to do this via the same origin policy. Pesky security!
*/


var fimfic = {
    isOnline: false,
    isLoggedIn: false,
    stories: [],

    // init fimfic connection, see if online and/or logged in
    initConnection: function (callback) {
        this.testLoggedIn(function () {
            callback.call();
        });
    },

    // test whether the user is logged into FIMFiction, set flag isLoggedIn
    testLoggedIn: function (callback) {
        var request = $.ajax({
            url: "http://fimfiction.net"
        });


        request.done(function (html) {
            fimfic.isOnline = true;

            var parsedhtml = $(html);
            fimfic.checkLoggedIn(parsedhtml);

            callback.call();
        });


        request.fail(function (jqXHR, textStatus) {
            fimfic.isOnline = false;
            fimfic.isLoggedIn = false;

            callback.call();
        });
    }, 

    // init fimfic database
    initDatabase: function (callback) {
        //$.indexedDB("fimfic_offline").deleteDatabase();

        $.indexedDB('fimfic_offline', {
            'version': 2,
            'schema': {
                '1': function (transaction) {
                    transaction.createObjectStore('meta');
                    transaction.createObjectStore('story_info');
                    transaction.createObjectStore('story_html');
                    transaction.createObjectStore('story_pics');
                }
            }
        }).done(function (db, event) {
            callback.call();
        });
    },

    // update list of stories
    updateStories: function (callback) {
        fimfic.listStories(function (code) {

            // replace db stories with listed stories

            callback.call(code);
        });
    },

    // return list of stories in read later list, from site
    listStories: function (callback) {
        var request = $.ajax({
            url: "http://www.fimfiction.net/index.php?view=category&read_it_later=1&compact_view=1"
        });


        fimfic.listedStories = [] // Will either get populated by .done, or be left blank


        request.done(function (html) {
            fimfic.isOnline = true;

            var parsedhtml = $(html);
            fimfic.checkLoggedIn(parsedhtml);

            // the following code loops over each row of story table, and manually extracts story data
            $.each($(parsedhtml).find('#archive_table').children('tbody').children(), function() {
                var id = $(this).find('u a').attr('href').split('/')[2];
                var title = $(this).find('u a').text();
                var description = $(this).find('.description').text();
                var author = $($($(this).children()[4]).children()[0]).text();

                //console.log('Adding Story: ' + title)

                fimfic.listedStories.push({
                    'id': id,
                    'title': title,
                    'description': description,
                    'author': author
                });
            });

            fimfic.listedStories = fimfic.listedStories.slice(0, 3); // TEST CODE, to minimise the impact on FimFic

            fimfic.listStoriesStatus = 'success';
            callback.call();
        });


        request.fail(function(jqXHR, textStatus) {
            fimfic.isOnline = false;
            fimfic.isLoggedIn = false;
            fimfic.listStoriesStatus = 'success';
            callback.call();
        });
    },

    // put stories from fimfic.listedStories into the page
    //  typically called right after listStories
    showListedStories: function () {
        $('#content').append($('<div id="stories"></div>'));

        $.each(fimfic.listedStories, function() {

            story = $('<div class="story"></div>');
            story.attr('fim_id', this.id); // because we mess with the fimfic.listedStories array,
                                           //  we need this to be able to find correct divs later

            storyheader = $('<div class="head"></div>');
            story.append(storyheader);

            storyheader.append($('<div class="statback"><div class="statbulb notready"></div></div>'));

            storyheader.append($('<h2></h2>').text(this.title));
            storyheader.append($('<span>&nbsp;&nbsp;by </span>'));
            storyheader.append($('<span class="author"></span>').text(this.author));


            storybody = $('<div class="body"></div>');
            story.append(storybody);

            storybody.append($('<span class="description"></span>').text(this.description));

            $('#stories').append(story);
        });
    },

    // recursively grabs the story info from listedStories, downloads the necessary info
    //  and modifies the page elements as necessary
    recurseListedStories: function (callback) {
        var currentStory = fimfic.listedStories.shift(); // pops first story off into currectStory

        var bulb = $('#stories .story[fim_id="'+currentStory.id+'"] .statbulb');
        $(bulb).removeClass('notready').addClass('loading');

        var currentJSON = $.getJSON('http://www.fimfiction.net/api/story.php?story=' + currentStory.id);

        currentJSON.success(function (data) {
            // pop old id off story_info and compare to new info
            // if necessary, update the html for the story and continue
            fimfic.story_info.get(data.story.id, false, function (value) {
                value = ((typeof value === "undefined") || (value === null)) ? [] : value;
                if (value.length > 0) {
                    console.log('return value found: ', value);
                }
                fimfic.story_info.add(data.story.id, data.story);

                // if story has new chapters, has updated, etc
                fimfic.should_get_html(value, data.story, function (getHtml) {
                    if (getHtml) {
                        // download new html, etc
                        console.log('we need to download new html, then');

                        var request = $.ajax({
                            url: 'http://www.fimfiction.net/download_story.php?story='+data.story.id+'&html'
                        });

                        request.done(function (html) {
                            html = html.split('</head>')[1]; // so it's easier to integrate later
                            fimfic.story_html.add(data.story.id, html, true);

                            fimfic.recurseListedStoriesFinish(bulb, callback);
                        });

                        request.fail(function (jqXHR, textStatus) {
                            console.log('html retrieval failed, ', data.story.id, jqXHR, textStatus);

                            fimfic.recurseListedStoriesFinish(bulb, callback);
                        });

                    } else {
                        console.log("nah, we're fine for new html, thanks");
                        fimfic.recurseListedStoriesFinish(bulb, callback);
                    }
                });
            });
        });

        currentJSON.error(function () {
            console.log('    Failed')
            if (fimfic.listedStories.length > 0) {
                fimfic.recurseListedStories(function () {
                    callback.call();
                });
            } else {
                callback.call();
            }
        });
    },

    // need this because of the async html-grabbing method
    recurseListedStoriesFinish: function (bulb, callback) {
        // do after we finish /all/ other work
        $(bulb).removeClass('loading').addClass('ready');

        if (fimfic.listedStories.length > 0) {
            fimfic.recurseListedStories(function () {
                callback.call();
            });
            //callback.call(); // for now, only do one story, no recursion
        } else {
            callback.call();
            // should put delays on there to keep from hammering FimFic's servers as much?
            //  talk to FimFic's server admin to discuss this and other methods
        }
    },

    // checks to see whether we should get new story html
    should_get_html: function (oldData, newData, callback) {
        fimfic.story_html.get(newData.id, true, function (value) {
            // new story, no html stored yet
            if (value === null) {
                callback.call(this, true);
            }

            // updated story
            if (newData.date_modified > oldData.date_modified) {
                callback.call(this, true);
            } else {
                callback.call(this, false);
            }
        })
    },


    // set isLoggedIn variable, given html
    //
    // we do this every request, as isLoggedIn is
    //  only used as an info variable, rather than
    //  to actually keep us from programatically
    //  making requests... Nicer to keep everything
    //  totally dynamic, I think.
    checkLoggedIn: function (parsedhtml) {
        // login_area div only shown
        //  when user has yet to login
        if ($(parsedhtml).find('#login_area').length > 0) {
            fimfic.isLoggedIn = false;
        } else {
            fimfic.isLoggedIn = true;
        }
    },

    // abstraction classes, to abstract out generic_store below
    story_info: {
        add: function (id, value, isString) {
            fimfic.generic_store.add('story_info', id, value, isString);
        }, 
        get: function (id, isString, callback) {
            fimfic.generic_store.get('story_info', id, isString, function (value) {
                callback.call(this, value);
            });
        }
    },
    story_html: {
        add: function (id, value, isString) {
            fimfic.generic_store.add('story_html', id, value, isString);
        }, 
        get: function (id, isString, callback) {
            fimfic.generic_store.get('story_html', id, isString, function (value) {
                callback.call(this, value);
            });
        }
    },

    // need this to deal with stuff like json conversion automatically
    generic_store: {
        add: function (store, id, value, isString) {
            isString = (typeof isString === "undefined") ? false : isString;

            if (!isString) {
                // convert to a string
                value = $.toJSON(value)
            }
            
            $.indexedDB('fimfic_offline').objectStore(store).put(value, id);
            // dunno why, but Chrome seems to barf if indexeddb holds actual data, rather than
            //  a plain old string... Implicitly convert stuff to strings, herpa
        },

        get: function (store, id, isString, callback) {
            isString = (typeof isString === "undefined") ? false : isString;

            var promise = $.indexedDB('fimfic_offline').objectStore(store).get(id);

            promise.done(function (value, event) {
                if (!isString) {
                    // turn back into object from json storage
                    value = $.parseJSON(value);
                }

                callback.call(this, value);
            });

            promise.fail(function (error, event) {
                console.log('generic_store.get failed: ', store, id, isString, error, event);

                callback.call(null);
            });
        }
    }
}


$(document).ready(function () {

    // setup story click handlers
    $(document).on('click', '#stories .story', function(event) {
        if ($(this).find('.statbulb').hasClass('ready')) {
            var story_id = parseInt($(this).attr('fim_id'));

            $('#stories').slideUp(400, function () {
                var current_story = $('<div id="current_story"></div>').hide();
                $('#content').append(current_story);
                $('#current_story').append($('<div class="head"></div>'));
                $('#current_story').append($('<div class="body"></div>'));

                fimfic.story_info.get(story_id, false, function (value) {

                    $('#current_story .head').append($('<h2></h2>').text(value.title));
                    $('#current_story .head').append($('<span>&nbsp;&nbsp;by </span>'));
                    $('#current_story .head').append($('<span class="author"></span>').text(value.author.name));

                    fimfic.story_html.get(story_id, true, function (html) {
                        $('#current_story .body').append($(html));

                        var toDelete = [];
                        var continueAddingItems = true;
                        $.each($('#current_story .body').children(), function (index, value) {
                            if (continueAddingItems) {
                                if (!($(value).is('h1') || $(value).is('h3'))) {
                                    toDelete.push(index);
                                    console.log('delete item at index '+index);
                                }
                                if ($(value).is('h3')) {
                                    continueAddingItems = false;

                                    var offset = 0;
                                    console.log('todelete: ', toDelete);
                                    $.each(toDelete, function (index, value) {
                                        $($('#current_story .body').children()[value-offset]).remove();

                                        if (index == (toDelete.length-1)) {
                                            $('#current_story').slideDown();
                                        } else {
                                            offset += 1;
                                        }
                                    });
                                }
                            }
                        });
                    });
                });
            });
        }
    });

    // Initialise database
    fimfic.initDatabase(function () {
        fimfic.updateStories(function (code) {
            fimfic.showListedStories();

            // Check DB up here somewhere, for if no network access
            //  assume we fall through to below if we have network access,
            //  or this is a new database with no info in it

            // Check 'net connection
            if (fimfic.isLoggedIn) {
                if (fimfic.listStoriesStatus == 'success') {
                    $('#status span').fadeOut(400, function () {
                        $('#status span').text("Checking whether anything's updated").fadeIn();
                    });

                    fimfic.recurseListedStories(function () {
                        $('#status span').fadeOut(400, function () {
                            $('#status span').text("Finished!").fadeIn();
                        });
                        $('#status').delay(4000).fadeOut(400);
                    });

                } else {
                    $('#status span').fadeOut(400, function () {
                        $('#status span').text("Failed to access Read Later list").fadeIn();
                    });
                }
            } else if (fimfic.isOnline) {
                $('#status span').fadeOut(400, function () {
                    $('#status span').text("You need to login to fimfiction to use this site").fadeIn();
                });
            } else {
                $('#status span').fadeOut(400, function () {
                    $('#status span').text("You need internet access to download stories (or cross-origin ajax error)").fadeIn();
                });
            }

        });
    });
});
