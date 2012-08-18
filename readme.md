FIMFiction Offline Reader
=========================

In a nutshell, this web-app downloads all the stories in your FIMFiction Read Later list, and stores them locally.

They will all be accessable for reading on-the-go.

Currently, this does not function in most browsers due to the same-origin policy. In the future, I hope the admins and I can work out a way to allow this to work through that, though. So, for now, you need to use Chrome running with --web-security-disabled in order to access and use this.

To see what would look like if the CORS stuff was setup, [here's the example page](http://fim.danneh.net/off)

Libraries
---------

I could hardly do all this just by myself. Standing on the shoulders of some other awesome projects, here's a list of the libraries/resources I've used

[jquery](http://jquery.com/) - jQuery. Simply the best javascript library in existence  
[jquery-json](http://code.google.com/p/jquery-json/) - jQuery plugin to add $.toJSON()  
[jquery-indexddb](https://github.com/axemclion/jquery-indexeddb) - Provides a simply jQuery-onic interface for IndexedDB  
[IndexedDBShim](https://github.com/axemclion/IndexedDBShim) - Provides an IndexedDB runtime using WebSQL, for those other browsers    