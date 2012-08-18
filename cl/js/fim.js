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
		fimfic.db = $.indexedDB("fimfic_offline", {
			"version": 1,
			"upgrade": function(transaction) {
				// initialise database, if not already done so
				transaction.createObjectStore("stories");
			}
		});
	},

	// update list of stories
	updateStories: function (callback) {
		console.log("Returning stories in user's Read Later list");

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

			$('#content').append($('<div id="stories"></div>'));

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

				story = $('<div class="story"></div>');


				storyheader = $('<div class="head"></div>');
				story.append(storyheader);

				storyheader.append($('<h2></h2>').text(title));
				storyheader.append($('<span>&nbsp;&nbsp;by </span>'));
				storyheader.append($('<span class="author"></span>').text(author));


				storybody = $('<div class="body"></div>');
				story.append(storybody);

				storybody.append($('<span class="description"></span>').text(description));

				$('#stories').append(story);
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
	}
}


$(document).ready(function () {
	// Initialise database, if not done so already
	fimfic.initDatabase();

	fimfic.updateStories(function (code) {

		// Check 'net connection
		if (fimfic.isLoggedIn) {
			if (fimfic.listStoriesStatus == 'success') {
				$('#status').text("Read Later list obtained").delay(4000).fadeOut(400);
			} else {
				$('#status').text("Failed to access Read Later list");
			}
		} else if (fimfic.isOnline) {
			$('#status').text("You need to login to fimfiction to use this site");
		} else {
			$('#status').text("You need internet access to download stories (or cross-site ajax error)");
			// or, you know, the cross-site xmlhttprequest hasn't been setup yet
		}

	});
});
