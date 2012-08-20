/* FIMFiction Offline Reader
**  Basically, downloads every story in the user's Read Later list
**  to localStorage. The fimfic class below basically creates a nice
**  little class to abstract all that out.
**
**  Now, it doesn't work with normal browsers yet, since we're not
**  allowed to do this via the same origin policy. Pesky security!
*/


var fimfic = {
    isCached: false,
    isOnline: false,
    isLoggedIn: false,
    stories: [],
    request_url: 'http://www.fimfiction.net/index.php?view=category&read_it_later=1&compact_view=1',

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
            url: fimfic.request_url
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
                    'author': {
                        'name': author
                    }
                });
            });

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
        $.each(fimfic.listedStories, function() {
            if ($('#stories').find('[fim_id="'+this.id+'"]').length > 0) {
                // already exists, just mark green
            } else {
                story = $('<div class="story"></div>');
                story.attr('fim_id', this.id); // because we mess with the fimfic.listedStories array,
                                               //  we need this to be able to find correct divs later

                storyheader = $('<div class="head"></div>');
                story.append(storyheader);

                storyheader.append($('<div class="statback"><div class="statbulb notready"></div></div>'));

                storyheader.append($('<h2></h2>').text(this.title));
                storyheader.append($('<span>&nbsp;&nbsp;by </span>'));
                storyheader.append($('<span class="author"></span>').text(this.author.name));


                storybody = $('<div class="body"></div>');
                story.append(storybody);

                storybody.append($('<span class="description"></span>').text(this.description));

                $('#stories').append(story);
            }
        });
    },

    // put stories from database into the page
    showDatabaseStories: function (callback) {
        fimfic.story_info.count(function (values) {

            // stolen from http://stackoverflow.com/questions/5223/length-of-javascript-object-ie-associative-array
            var values_len = values.length ? --values.length : -1;
            for (var k in values)
                values_len++;

            if (values_len < 1) {
                fimfic.isCached = false;
                callback.call();
            } else {
                // we have stories cached
                fimfic.isCached = true;

                var timesRun = 0;
                var timesToRun = values_len;

                $.each(values, function () {
                    story = $('<div class="story"></div>');

                    story.attr('fim_id', this.id); // keeping track of things

                    storyheader = $('<div class="head"></div>');
                    story.append(storyheader);

                    storyheader.append($('<div class="statback"><div class="statbulb stored"></div></div>'));

                    storyheader.append($('<h2></h2>').text(this.title));
                    storyheader.append($('<span>&nbsp;&nbsp;by </span>'));
                    storyheader.append($('<span class="author"></span>').text(this.author.name));


                    storybody = $('<div class="body"></div>');
                    story.append(storybody);

                    if (fimfic.isOnline && (!(typeof this.image == "undefined"))) {
                        storybody.append($('<img class="storyimage" />').attr('src', 'http:'+this.image));
                    }
                    if (this.short_description == '') {
                        var description = this.description;
                    } else {
                        var description = this.short_description;
                    }
                    storybody.append($('<span class="description"></span>').text(description));
                    // if we want the long description, we'll want to write a full bbcode parser, and all that
                    if (fimfic.isOnline && (!(typeof this.image == "undefined"))) {
                        storybody.append($('<div class="storyimagefix"></div>'));
                    }

                    $('#stories').prepend(story);

                    timesRun += 1;

                    if (timesRun == timesToRun) {
                        callback.call();
                    }
                });
            }
        });
    },

    // recursively grabs the story info from listedStories, downloads the necessary info
    //  and modifies the page elements as necessary
    recurseListedStories: function (callback) {
        var currentStory = fimfic.listedStories.shift(); // pops first story off into currectStory

        var bulb = $('#stories .story[fim_id="'+currentStory.id+'"] .statbulb');
        $(bulb).removeClass('notready').removeClass('stored').addClass('loading');

        fimfic.download_info(currentStory.id, function (data, getHtml) {
            if (getHtml) {

                fimfic.download_html(data.story.id, bulb, function () {
                    fimfic.recurseListedStoriesFinish(bulb, callback);
                });

            } else {
                // do after we finish /all/ other work
                $(bulb).removeClass('loading').addClass('ready');

                fimfic.recurseListedStoriesFinish(bulb, callback);
            }
        });
    },

    // need this because of the async html-grabbing method
    recurseListedStoriesFinish: function (bulb, callback) {
        if (fimfic.listedStories.length > 0) {
            fimfic.recurseListedStories(function () {
                callback.call();
            });
        } else {
            callback.call();
            // should put delays on there to keep from hammering FimFic's servers as much?
            //  talk to FimFic's server admin to discuss this and other methods
        }
    },

    // downloads new story info
    download_info: function (id, callback) {
        var currentJSON = $.getJSON('http://www.fimfiction.net/api/story.php?story=' + id);

        currentJSON.success(function (data) {
            // pop old id off story_info and compare to new info
            // if necessary, update the html for the story and continue
            fimfic.story_info.get(data.story.id, function (value) {
                value = ((typeof value === "undefined") || (value === null)) ? [] : value;
                if (value.length > 0) {
                    console.log('return value found: ', value);
                }
                fimfic.story_info.add(data.story.id, data.story);

                // get image - store in story_pics store as a base64 string,
                //  to put into an image tag later
                // (check whether you can simply put a base64 string inside an img tag,
                //   and have it automatically change size to fit)

                // full image, or just thumb? Probably just thumb

                // also, get local copy of both the Python and jQuery docs

                // also, code story deletion stuff
                
                // Story Controls: ^ button to make controls roll into Navbar
                // Next Page/Get More button, etc

                // if story has new chapters, has updated, etc
                fimfic.should_get_html(value, data.story, function (getHtml) {
                    callback.call(this, data, getHtml);
                });
            });
        });

        currentJSON.error(function () {
            console.log('    Failed')
            callback.call(this, [], false);
        });
    },

    // downloads new story html
    download_html: function (id, bulb, callback) {
        var request = $.ajax({
            url: 'http://www.fimfiction.net/download_story.php?story='+id+'&html'
        });

        request.done(function (html) {
            html = html.split('</head>')[1]; // so it's easier to integrate later
            fimfic.story_html.add(id, html);

            // do after we finish /all/ other work
            $(bulb).removeClass('loading').addClass('ready');

            callback.call();
        });

        request.fail(function (jqXHR, textStatus) {
            console.log('html retrieval failed, ', jqXHR, textStatus, id, bulb, callback);

            // do after we finish /all/ other work
            $(bulb).removeClass('loading').addClass('notready');

            callback.call();
        });
    },

    // checks to see whether we should get new story html
    should_get_html: function (oldData, newData, callback) {
        fimfic.story_html.get(newData.id, function (value) {
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

    // switches to to-read list
    switchToReadLater: function () {
        fimfic.request_url = 'http://www.fimfiction.net/index.php?view=category&read_it_later=1&compact_view=1';
        fimfic.switchList();
    },
    // switches to browse
    switchToBrowse: function () {
        fimfic.request_url = 'http://www.fimfiction.net/index.php?view=category&compact_view=1';
        fimfic.switchList();
    },
    // switches to new list
    switchList: function () {
        $('.statbulb.notready').parent().parent().parent().slideUp(function () {
            $(this).remove()
        });
        fimfic.listStories(function () {
            fimfic.showListedStories();
        });
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
    meta: {
        add: function (id, value) {
            fimfic.generic_store.add('meta', id, value);
        }, 
        get: function (id, callback) {
            fimfic.generic_store.get('meta', id, function (value) {
                callback.call(this, value);
            });
        },
        count: function (callback) {
            fimfic.generic_store.count('meta', function (value) {
                callback.call(this, value);
            });
        }
    },
    story_info: {
        add: function (id, value) {
            fimfic.generic_store.add('story_info', id, value);
        }, 
        get: function (id, callback) {
            fimfic.generic_store.get('story_info', id, function (value) {
                callback.call(this, value);
            });
        },
        count: function (callback) {
            fimfic.generic_store.count('story_info', function (value) {
                callback.call(this, value);
            });
        }
    },
    story_html: {
        add: function (id, value) {
            fimfic.generic_store.add('story_html', id, value);
        }, 
        get: function (id, callback) {
            fimfic.generic_store.get('story_html', id, function (value) {
                callback.call(this, value);
            });
        },
        count: function (callback) {
            fimfic.generic_store.count('story_html', function (value) {
                callback.call(this, value);
            });
        }
    },
    story_pics: {
        add: function (id, value) {
            fimfic.generic_store.add('story_pics', id, value);
        }, 
        get: function (id, callback) {
            fimfic.generic_store.get('story_pics', id, function (value) {
                callback.call(this, value);
            });
        },
        count: function (callback) {
            fimfic.generic_store.count('story_pics', function (value) {
                callback.call(this, value);
            });
        }
    },

    // need this to deal with stuff like json conversion automatically
    generic_store: {
        add: function (store, id, value) {
            // convert to a string
            value = $.toJSON(value)
            
            $.indexedDB('fimfic_offline').objectStore(store).put(value, id);
            // dunno why, but Chrome seems to barf if indexeddb holds actual data, rather than
            //  a plain old string... Implicitly convert stuff to strings, herpa
        },

        get: function (store, id, callback) {
            var promise = $.indexedDB('fimfic_offline').objectStore(store).get(id);

            promise.done(function (value, event) {
                // turn back into object from json storage
                value = $.parseJSON(value);

                callback.call(this, value);
            });

            promise.fail(function (error, event) {
                console.log('generic_store.get failed: ', store, id, error, event);

                callback.call(null);
            });
        },

        count: function (store, callback) {
            var allValues = {};

            var promise = $.indexedDB('fimfic_offline').objectStore(store).each(function (item) {
                // turn objects back into object from json storage
                allValues[item.key] = $.parseJSON(item.value);
            });

            promise.done(function (value, event) {
                callback.call(this, allValues);
            });

            promise.fail(function (error, event) {
                console.log('generic_store.count failed: ', store, id, error, event);

                callback.call(null);
            });
        }
    }
}


$(document).ready(function () {

    // header
    $(document).on('click', '.header', function (event) {
        window.location = 'http://fimfiction.net';
    });

    // footer
    $(document).on('click', '#footer .head', function (event) {
        $('#footer .body').slideToggle();
    });


    jQuery.fn.slideLeftHide = function( speed, callback ) { this.animate( { width: "hide", paddingLeft: "hide", paddingRight: "hide", marginLeft: "hide", marginRight: "hide" }, speed, callback ); }
    jQuery.fn.slideLeftShow = function( speed, callback ) { this.animate( { width: "show", paddingLeft: "show", paddingRight: "show", marginLeft: "show", marginRight: "show" }, speed, callback ).css('display', 'inline-block'); }

    // navbar browse
    $(document).on('click', '#navbar .browse', function (event) {
        event.preventDefault(); // stop href from messing up things
        fimfic.switchToBrowse();
        $(this).slideLeftHide(function () {
            $('#navbar .readlater').slideLeftShow();
        });
    });
    // navbar readlater
    $(document).on('click', '#navbar .readlater', function (event) {
        event.preventDefault(); // stop href from messing up things
        fimfic.switchToReadLater();
        $(this).slideLeftHide(function () {
            $('#navbar .browse').slideLeftShow();
        });
    });

    // navbar show only new stories
    $(document).on('click', '#navbar .shownew', function (event) {
        event.preventDefault(); // stop href from messing up things
        $(this).slideLeftHide(function () {
            $('#navbar .showall').slideLeftShow();
        });
        $('.statbulb.ready').parent().parent().parent().slideUp();
        $('.statbulb.stored').parent().parent().parent().slideUp();
    });
    // navbar show all stories
    $(document).on('click', '#navbar .showall', function (event) {
        event.preventDefault(); // stop href from messing up things
        $(this).slideLeftHide(function () {
            $('#navbar .shownew').slideLeftShow();
        });
        $('.statbulb.ready').parent().parent().parent().slideDown();
        $('.statbulb.stored').parent().parent().parent().slideDown();
    });

    // navbar clearall
    $(document).on('click', '#navbar .clearall', function (event) {
        event.preventDefault(); // stop href from messing up things
        if (confirm('Clear all stories?')) {
            $('#stories').fadeOut();
        }
    });

    // fim bar
    function backfromstory () {
        $('#footer').fadeOut(200);
        $('.story-controls').slideUp(200, function () {
            $('.story-controls').remove();
            $('#current_story').fadeOut(200, function () {
                $(this).remove();
                $('#stories').fadeIn();
                $('#footer').fadeIn();
            });
        });
    }

    $(document).on('click', '.back-from-story', function (event) {
        event.preventDefault(); // stop href from messing up things
        backfromstory();
    });
    $(document).on('click', '#current_story .head', function (event) {
        event.preventDefault(); // stop href from messing up things
        backfromstory();
    });

    // Now, to make it save the below selections in the 'meta' table thingy!

    $(document).on('click', '.story-controls .change-color', function(event) {
        event.preventDefault(); // stop href from messing up things

        if ( $('body').hasClass('light') ) {
            $('body').removeClass('light');
            $('body').addClass('dark');
            fimfic.meta.add('color', 'dark');
        } else {
            $('body').addClass('light');
            $('body').removeClass('dark');
            fimfic.meta.add('color', 'light');
        }
    });

    $(document).on('click', '.story-controls .change-font', function(event) {
        event.preventDefault(); // stop href from messing up things

        if ( $('body').hasClass('serif') ) {
            $('body').removeClass('serif');
            $('body').addClass('sans');
            fimfic.meta.add('font-face', 'sans');
        } else if ( $('body').hasClass('sans') ) {
            $('body').removeClass('sans');
            $('body').addClass('mono');
            fimfic.meta.add('font-face', 'mono');
        } else {
            $('body').removeClass('mono');
            $('body').addClass('serif');
            fimfic.meta.add('font-face', 'serif');
        }
    });

    $(document).on('click', '.story-controls .change-larger', function(event) {
        event.preventDefault(); // stop href from messing up things

        var currentFontSize = $('#current_story .body').css('font-size');
        var currentFontSizeNum = parseFloat(currentFontSize, 10);
        var newFontSize = currentFontSizeNum*1.1;
        $('#current_story .body').css('font-size', newFontSize, true);

        fimfic.meta.add('font-size', newFontSize);
    });

    $(document).on('click', '.story-controls .change-smaller', function(event) {
        event.preventDefault(); // stop href from messing up things

        var currentFontSize = $('#current_story .body').css('font-size');
        var currentFontSizeNum = parseFloat(currentFontSize, 10);
        var newFontSize = currentFontSizeNum*0.9;
        $('#current_story .body').css('font-size', newFontSize, true);

        fimfic.meta.add('font-size', newFontSize);
    });

    // setup story click handlers
    $(document).on('click', '#stories .story', function(event) {
        if ($(this).find('.statbulb').hasClass('ready') || $(this).find('.statbulb').hasClass('stored')) {
            var story_id = parseInt($(this).attr('fim_id'));

            $('#footer').fadeOut(200);
            $('#stories').fadeOut(200, function () {
                var current_story = $('<div id="current_story"></div>').hide();
                $('#content').append(current_story);
                $('#current_story').append($('<div class="head"></div>'));
                $('#current_story').append($('<div class="body"></div>'));

                fimfic.story_info.get(story_id, function (value) {

                    $('#current_story .head').append($('<div class="back-from-story"><i class="icon-left-open"></i>'));
                    $('#current_story .head').append($('<h2></h2>').text(value.title));
                    $('#current_story .head').append($('<span>&nbsp;&nbsp;by </span>'));
                    $('#current_story .head').append($('<span class="author"></span>').text(value.author.name));

                    // that whole dragons-be-here code down there basically culls everything from
                    //  the start of the story html but the h1 and h3.
                    // h1 because that's the story title, and we hijack that to make the h3,
                    //  the chapter title, display properly. the other elements FimFic adds are
                    //  probably useful, but for now they just mess up layout

                    fimfic.story_html.get(story_id, function (html) {
                        $('#current_story .body').append($(html));
                        $('body').append($('<div class="story-controls control" style="display: none; "><a class="change back-from-story" href="http://danneh.net/"><i class="icon-left-open"></i></a><a class="change change-color" href="http://danneh.net/"><i class="icon-bg"></i></a><a class="change change-font" href="http://danneh.net/"><i class="icon-font"></i></a><a class="change change-smaller" href="http://danneh.net/"><i class="icon-minus"></i></a><a class="change change-larger" href="http://danneh.net/"><i class="icon-plus"></i></a></div>'));
                        $('.story-controls').hide();

                        var toDelete = [];
                        var continueAddingItems = true;
                        $.each($('#current_story .body').children(), function (index, value) {
                            if (continueAddingItems) {
                                if (!($(value).is('h1') || $(value).is('h3'))) {
                                    toDelete.push(index);
                                }
                                if ($(value).is('h3')) {
                                    continueAddingItems = false;

                                    $(value).text($(value).text().slice(9)); // remove Chapter: from start of header

                                    var offset = 0;
                                    $.each(toDelete, function (index, value) {
                                        $($('#current_story .body').children()[value-offset]).remove();

                                        if (index == (toDelete.length-1)) {
                                            // set options from database
                                            fimfic.meta.get('font-face', function (value) {
                                                value = ((typeof value === "undefined") || (value === null)) ? 'serif' : value;
                                                $('body').addClass(value);

                                                fimfic.meta.get('font-size', function (value) {
                                                    value = ((typeof value === "undefined") || (value === null)) ? '100%' : value;
                                                    $('#current_story .body').css('font-size', value, true);

                                                    $('#current_story').fadeIn(200, function () {
                                                        $('#footer').fadeIn();
                                                        $('.story-controls').slideDown(200);
                                                    });

                                                });

                                            });
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
        } else if ($(this).find('.statbulb').hasClass('notready')) {
            // download this story to our cache
            var bulb = $(this).find('.statbulb');
            $(bulb).removeClass('notready').addClass('loading');
            fimfic.download_info($(this).attr('fim_id'), function (data, getHtml) {
                fimfic.download_html(data.story.id, bulb, function () {
                    // do nothing
                });
            });
        }
    });

    // Initialise database
    fimfic.initConnection(function () {
        fimfic.initDatabase(function () {
            fimfic.showDatabaseStories(function () {

                fimfic.meta.get('color', function (value) {
                    value = ((typeof value === "undefined") || (value === null)) ? 'light' : value;
                    $('body').addClass(value);
                    fimfic.updateStories(function (code) {

                        if ((fimfic.isCached) && (!fimfic.isOnline)) {
                            $('#status span').fadeOut(400, function () {
                                $('#status span').text("Stories are cached, operating in offline mode").fadeIn();
                            });
                            $('#status').delay(2000).fadeOut(400);
                        } else if (fimfic.isLoggedIn) {
                            fimfic.showListedStories();

                            if (fimfic.listStoriesStatus == 'success') {
                                $('#status span').fadeOut(400, function () {
                                    $('#status span').text("Checking whether anything's updated").fadeIn();
                                });
                                // actually check for updates and stuff, you know

                                if (fimfic.isCached) {
                                    $('#status span').fadeOut(400, function () {
                                        $('#status span').text("Loaded!").fadeIn();
                                        $('#status').delay(2000).fadeOut(400);
                                    });
                                } else {
                                    $('#status span').fadeOut(400, function () {
                                        $('#status span').text("Click on a story to store it offline. Click again to open it!").fadeIn();
                                        $('#status').delay(8000).fadeOut(400);
                                    });
                                }

                            } else {
                                $('#status span').fadeOut(400, function () {
                                    $('#status span').text("Failed to access Read Later list").fadeIn();
                                });
                            }
                        } else if (fimfic.isOnline) {
                            $('#status span').fadeOut(400, function () {
                                $('#status span').text("Login to FimFic to display your Read Later stories").fadeIn();
                                fimfic.switchToBrowse();
                                $('#navbar .readlater').hide();
                                $('#navbar .browse').hide();
                            });

                            // switch to Browse list
                        } else {
                            $('#status span').fadeOut(400, function () {
                                $('#status span').text("You need internet access to download stories (or cross-origin ajax error)").fadeIn();
                            });
                        }
                    });

                });
            });
        });
    });
});
