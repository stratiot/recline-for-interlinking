jQuery(function($) {
  window.multiView = null;
  window.explorerDiv = $('.data-explorer-here');

  // create the demo dataset
  var dataset = createDemoDataset();
  // now create the multiview
  // this is rather more elaborate than the minimum as we configure the
  // MultiView in various ways (see function below)
  window.multiview = createMultiView(dataset);

  // last, we'll demonstrate binding to changes in the dataset
  // this will print out a summary of each change onto the page in the
  // changelog section
  dataset.records.bind('all', function(name, obj) {
    var $info = $('<div />');
    $info.html(name + ': ' + JSON.stringify(obj.toJSON()));
    $('.changelog').append($info);
    $('.changelog').hide();
  });
});

// create standard demo dataset
function createDemoDataset() {


  var myrecords = [];
  for (i=0;i<10;i++){
    //myrecords.push({id: i, date: '2011-03-03', x: Math.ceil(Math.random()*10), y: 6, z: 9, country: 'US', title: 'third', lat:40.00, lon:-75.5});
	  myrecords.push({id: i, date: '2011-03-03', x: Math.ceil(Math.random()*10), lat:i*100, lon:-75.5});
  }
  
  var dataset = new recline.Model.Dataset({
    records: myrecords,
    // let's be really explicit about fields
    // Plus take opportunity to set date to be a date field and set some labels
    fields: [
      {id: 'id'},
      {id: 'date', type: 'date'},
      {id: 'x', type: 'number'},/*
      {id: 'y', type: 'number'},
      {id: 'z', type: 'number'},
      {id: 'country', 'label': 'Country'},
      {id: 'title', 'label': 'Title'},
      */{id: 'lat'},
      {id: 'lon'}
    ]
  });
  return dataset;
}

// make MultivView
//
// creation / initialization in a function so we can call it again and again
var createMultiView = function(dataset, state) {
  // remove existing multiview if present
  var reload = false;
  if (window.multiView) {
    window.multiView.remove();
    window.multiView = null;
    reload = true;
  }

  var $el = $('<div />');
  $el.appendTo(window.explorerDiv);

  // customize the subviews for the MultiView
  var views = [
    {
      id: 'grid',
      label: 'Grid',
      view: new recline.View.SlickGrid({
        model: dataset,
        state: {
          gridOptions: {
            editable: false,
            // Enable support for row add
            enabledAddRow: false,
            // Enable support for row delete
            enabledDelRow: false,
            // Enable support for row Reoder 
            enableReOrderRow:false,
            enableColumnReorder: false,
            autoEdit: false,
            enableCellNavigation: true
          },
          columnsEditor: [
            { column: 'date', editor: Slick.Editors.Date },
            { column: 'title', editor: Slick.Editors.Text }
          ]
        }
      })
    }
  ];

  var multiView = new recline.View.MultiView({
    model: dataset,
    el: $el,
    state: state,
    views: views
  });
  return multiView;
}