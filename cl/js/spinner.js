/* Spinner JS
**  from http://kilianvalkhof.com/uploads/spinners/
*/

//simple script to rotate all spinners 45 degrees on each tick
//this works differently from the css transforms, which is smooth

var count = 0;
function rotate() {
  var spinner = document.getElementById('spinner');
  spinner.style.MozTransform = 'scale(0.5) rotate('+count+'deg)';
  spinner.style.WebkitTransform = 'scale(0.5) rotate('+count+'deg)';
  if (count==360) { count = 0 }
  count+=45;
  window.setTimeout(rotate, 100);
}
window.setTimeout(rotate, 100);