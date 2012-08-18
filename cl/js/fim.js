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
                    //transaction.createObjectStore('story_pics');
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
        console.log('recurse story: ' + currentStory.id);

        var bulb = $('#stories .story[fim_id="'+currentStory.id+'"] .statbulb');
        $(bulb).removeClass('notready').addClass('loading');

        var currentJSON = $.getJSON('http://www.fimfiction.net/api/story.php?story=' + currentStory.id);

        currentJSON.success(function (data) {
            $(bulb).removeClass('loading').addClass('ready');
            console.log('    ' + data.story.title);

            //fimfic.story_info.put(currentStory.id, data.story);
            fimfic.story_info.add(data.story.id, data.story);
            //$.indexedDB('fimfic_offline').objectStore('story_info').put(756, 'data.story');


            //fimfic.transaction = db.transaction(['meta', 'story_info', 'story_html'])

            //fimfic.meta       = fimfic.transaction.objectStore('meta');
            //fimfic.story_info = fimfic.transaction.objectStore('story_info');
            //fimfic.story_html = fimfic.transaction.objectStore('story_html');

            if (fimfic.listedStories.length > 0) {
                //fimfic.recurseListedStories(function () {
                //    callback.call();
                //});
                callback.call(); // for now, only do one story, no recursion
            } else {
                callback.call();
            }
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





        /*fimfic.db = $.indexedDB("fimfic_offline", {
            "version": 84,
            "upgrade": function(transaction) {
                // initialise database, if not already done so
                console.log('Database Initialising')
                transaction.createObjectStore("meta"); // stores app metadata, list of cached stories and such

                transaction.createObjectStore("story_info"); // stores story info, metadata and such (think fimfiction API)
                transaction.createObjectStore("story_html"); // stores the actual story html
                //transaction.createObjectStore("story_image"); // stores the story images
            }
        });*/
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

    // story_info class, for nice calling and json conversion junk below
    story_info: {
        add: function (id, info) {
            console.log('adding info: id ' + id);
            console.log(info);
            $.indexedDB('fimfic_offline').objectStore('story_info').put($.toJSON(info), id);
            // dunno why, but Chrome seems to barf if indexeddb holds actual data, rather than
            //  a plain old string... Implicitly convert stuff to strings, herpa
        }
    }
}


$(document).ready(function () {
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
                        $('#status span').text("Read Later list obtained").fadeIn();
                    });

                    $('#status').delay(4000).fadeOut(400);

                    fimfic.recurseListedStories(function () {
                        console.log('Finished!');
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
