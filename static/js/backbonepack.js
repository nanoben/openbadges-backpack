ich.refresh();

!function setup () {
/** begin setup **/

var CSRF = $("input[name='_csrf']").val();
$.ajaxSetup({
  beforeSend: function (xhr, settings) {
    if (settings.crossDomain)
      return; 
    if (settings.type == "GET")
      return;
    xhr.setRequestHeader('X-CSRF-Token', CSRF)
  }
})

}()


!!function appInitialize (){
/** begin app **/
var dragging = false;


/** define: models **/ 
var BadgeModel = Backbone.Model.extend({
  // no defaults
});
var GroupModel = Backbone.Model.extend({
  defaults: {
    name: "New Group",
    badges: function () { new GroupCollection() },
    "public": false
  }
});

/** define: collections **/
var BadgeCollection = Backbone.Collection.extend({
  model: BadgeModel,
  belogsTo: null
})
var GroupCollection = Backbone.Collection.extend({
  url: '/collection',
  model: GroupModel
})

function saveParentGroup (badge) {
  this.belongsTo.save(null, {
    error: function () {
      console.log(':(');
      console.dir(this);
    },
    success: function (a, b, c) {
      console.log(':D');
      console.dir(this);
    }
  });
}

BadgeCollection.prototype.on('add', saveParentGroup)
BadgeCollection.prototype.on('remove', saveParentGroup)


/** define: views **/
var GroupView = Backbone.View.extend({
  parent: $('#groups'),
  
  tagName: "div",
  
  className: "group",
  
  events: {
    'keyup input': 'checkDone',
    'focus input': 'storeCurrent',
    'blur input': 'maybeUpdate',
    'drop': 'badgeDrop',
    'mousedown .delete': 'preventDefault',
    'click .delete': 'destroy'
  },
  
  storeCurrent: function (event) {
    var $el = $(event.currentTarget);
    $el.data('previously', $el.val());
  },
  
  checkDone: function (event) {
    var $el = $(event.currentTarget);
    
    switch (event.keyCode) {
     case 13:
      $el.trigger('blur');
      break;
      
     case 27:
      $el.val($el.data('previously'));
      $el.trigger('blur');
      break;
    }
  },
  
  destroy: function (event, a,b,c) {
    var group = this.model
      , allGroups = group.collection;
    allGroups.remove(group);
    this.$el.addClass('dying');
    this.$el.animate({opacity: 0});
    this.$el.slideUp(null, this.remove.bind(this));
  },
  
  preventDefault: function (event, a,b,c) {
    event.preventDefault();
    return false;
  },
  
  maybeUpdate: function (event) {
    var $el = $(event.currentTarget)
      , newName = $el.val()
      , oldName = $el.data('previously')
    
    if (newName === oldName)
      return;
    
    this.model.set({ name: newName });
    
    // #TODO: some real error doing ons.
    this.model.save(null, {
      error: function () {
        console.log(':(');
        console.dir(this);
      },
      success: function () {
        console.log(':D');
        console.dir(this);
      }
    })
  },
  
  addNew: function (event, badge) {
    var newBadge = new BadgeModel(badge.attributes)
      , newView = new BadgeView({model: newBadge})
      , collection = this.model.get('badges');
    collection.add(newBadge);
    newView.render();
    newView.addToGroup(this);
  },

  moveExisting: function (event, badge) {
    var badgeView = dragging;
    badge.collection.remove(badge);
    this.model.get('badges').add(badge);
    badgeView.addToGroup(this);
  },

  badgeDrop: function (event) {
    var view = dragging
      , badge = view.model
      , collection = this.model.get('badges');
    event.stopPropagation();
    
    if (collection.get(badge)) {
      return;
    } 
    
    if (!badge.collection) {
      return this.addNew(event, badge);
    }
    return this.moveExisting(event, badge);
  },
  
  render: function () {
    this.el = ich.groupTpl(this.model.attributes);
    this.$el = $(this.el)
      .hide()
      .appendTo(this.parent)
      .fadeIn();
  }
});

var BadgeView = Backbone.View.extend({
  tagName: "a",
  className: "badge",
  events: {
    'dragstart' : 'start'
  },
  start : function (event) {
    dragging = this;
  },
  
  addToGroup: function (groupView) {
    var $el = this.$el
      , $groupEl = groupView.$el
      , isNew = (0 === $groupEl.find('.badge').length)
    
    $groupEl.removeClass('isNew');
    
    function doIt () {
      $el.sync(
        ['fadeOut', 'fast'],
        ['appendTo', $groupEl],
        ['fadeIn', 'fast']
      );
    }
    
    if (isNew) {
      $groupEl.find('.instructions').fadeOut('linear', doIt);
      (new GroupView({model: new GroupModel({})})).render()
    } else {
      doIt();
    }
  },
  
  render: function () {
    this.el = ich.badgeTpl(this.model.attributes);
    this.$el = $(this.el);
    this.$el.data('view', this);
  }
});


/**
 * Create a new collection for all of the groups to live in.
 */
var AllGroups = new GroupCollection();
AllGroups.on('remove', function (group) {
  group.destroy();
});

/**
 * Create a view for the body so we can drop badges onto it.
 */
(new (Backbone.View.extend({
  events: {
    'dragover': 'nothing',
    'dragenter': 'nothing',
    'drop': 'maybeRemoveBadge'
  },
  nothing: function (event) {
    event.preventDefault();
  },
  maybeRemoveBadge: function (event) {
    var badgeView = dragging
      , badge = badgeView.model;
    
    if (event.target.className === 'group')
      return;
    
    if (badge.collection) {
      badgeView.remove();
      badge.collection.remove(badge);
    }
  }
}))).setElement($('body'));;


/**
 * Create badge models *only for the non-grouped badges*, from bootstrapped
 * page and attach models to views.
 */

BadgeModel.fromElement = function (element) {
  var $el = $(element)
    , model = new BadgeModel({
      id: $el.data('id'),
      image: $el.find('img').attr('src')
    })
  new BadgeView({ model: model }).setElement($el);
  return model;
};

/**
 * Create models from bootstrapped page and attach models to views.
 */

GroupModel.fromElement = function (element) {
  var $el = $(element)
    , badgeElements = $el.find('.badge')
    , groupBadges = new BadgeCollection(_.map(badgeElements, BadgeModel.fromElement))
    , model = new GroupModel({
      id: $el.data('id'),
      name: $el.find('input').val(),
      badges: groupBadges
    });
  groupBadges.belongsTo = model;
  AllGroups.add(model);
  new GroupView({ model: model }).setElement($el);
};


var existingBadges = $('#badges').find('.badge')
  , existingGroups = $('#groups').find('.group');
_.each(existingBadges, BadgeModel.fromElement);
_.each(existingGroups, GroupModel.fromElement);

!!function browserId() {
  function launchBrowserId(callback) {
    return function() { navigator.id.getVerifiedEmail(callback); }
  }
  function handleResponse(assertion) {
    if (!assertion) return false;
    $('.js-browserid-input').val(assertion);
    $('.js-browserid-form').trigger('submit');
  }
  $('.js-browserid-link').bind('click', launchBrowserId(handleResponse));
}();

/*end scope*/
}()