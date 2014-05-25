/*\
 * Set.hoverset
 [ method ]
 **
 * Manages the over/out mouse handlers of an entire set. Use Set.mouseover() and 
 * Set.mouseout() to apply over/out handlers to each individual item - so mousing 
 * from overlapping will fire out/over event. Set.hoverset will treat the entire
 * set as a single element, so mousing over overlapping elements will not fire
 * individual over/out events. Over handler will fire only when user mouses onto
 * a set, and the out handler will fire only when the user mouses off the entire 
 * set.
 * 
 * The optional outdelay parameter will allow the user to mouse off and then
 * back onto a set within the specified number of milliseconds without firing the
 * out handler. 
 **
 > Parameters
 **
 - paper (object) the paper instance contianing the set
 - overfunc (function) function to run when set is moused over
 - outfunc (function) function to run when set is moused out
 - [outdelay] (number) number of milliseconds of leinience to wait before firing the out event.
 = (object) an object containing the mouseover and mouseout handlers. should be passed to the unhoverset function to remove the listeners
\*/
Raphael.st.hoverset = function(r, overfunc, outfunc, outdelay) {
	
	var home = this;

	var overhandler = function(evt){
		r.getById(evt.currentTarget.raphaelid).data("Raphael.st.hoverset.over", true);

		if(!home['Raphael.st.hoverset.overset']){
			overfunc.call(this, evt);
		}

		home['Raphael.st.hoverset.overset'] = true;
	}

	var outhandler = function(evt){
		var overset = false;
		r.getById(evt.currentTarget.raphaelid).data("Raphael.st.hoverset.over", false);
		
		clearTimeout(home['Raphael.st.hoverset.timeout']);
		home['Raphael.st.hoverset.timeout'] = setTimeout(function(){
			overset = lookForOver(home);
			if(!overset){
				home['Raphael.st.hoverset.overset'] = false;
				outfunc.call(this, evt);
			}
		}, outdelay || 0);
	}
	
	var lookForOver = function(set) {
		ret = false;
		set.forEach(function(obj){
			if(typeof(obj.forEach) == 'function') {
				ret = lookForOver(obj);
				if(ret) return false;
			} else if(typeof(obj.data) != 'function'){
				return true;
			}else if(obj.data('Raphael.st.hoverset.over')){
				ret = true;
				return false;
			}
		});
		return ret;
	}
	
	this.mouseover(overhandler);
	this.mouseout(outhandler);
	
	return {
		overhandler: overhandler,
		outhandler: outhandler
	}
}

/*\
 * Set.unhoverset
 [ method ]
 **
 * Removes Set.hoverset mouse handlers
 **
 > Parameters
 **
 - obj (object) the object returned by the Set.hoverset call to be removed
\*/
Raphael.st.unhoverset = function(obj) {
	this.unmouseover(obj.overhandler);
	this.unmouseout(obj.outhandler);
}
