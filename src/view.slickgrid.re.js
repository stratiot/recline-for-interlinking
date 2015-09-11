/*jshint multistr:true */

this.recline = this.recline || {};
this.recline.View = this.recline.View || {};

(function ($, my) {
    "use strict";

// ## SlickGrid Dataset View
//
// Provides a tabular view on a Dataset, based on SlickGrid.
//
// https://github.com/mleibman/SlickGrid
//
// Initialize it with a `recline.Model.Dataset`.
//
// Additional options to drive SlickGrid grid can be given through state.
// The following keys allow for customization:
// * gridOptions: to add options at grid level
// * columnsEditor: to add editor for editable columns
//
// For example:
//    var grid = new recline.View.SlickGrid({
//         model: dataset,
//         el: $el,
//         state: {
//          gridOptions: {
//            editable: true,
//            enableAddRow: true 
//            // Enable support for row delete
//            enabledDelRow: true,
//            // Enable support for row Reorder 
//            enableReOrderRow:true,
//            ...
//          },
//          columnsEditor: [
//            {column: 'date', editor: Slick.Editors.Date },
//            {column: 'title', editor: Slick.Editors.Text}
//          ]
//        }
//      });
//// NB: you need an explicit height on the element for slickgrid to work
my.SlickGrid = Backbone.View.extend({
  initialize: function(modelEtc) {
    var self = this;
    this.$el.addClass('recline-slickgrid');
    // Template for row delete menu , change it if you don't love 
    this.templates = {
      "deleterow" : '<a href="#" class="recline-row-delete btn" title="Delete row">X</a>'
    };
    _.bindAll(this, 'render', 'onRecordChanged');
    this.listenTo(this.model.records, 'add remove reset', this.render);
    this.listenTo(this.model.records, 'change', this.onRecordChanged);
    var state = _.extend({
      hiddenColumns: [],
      columnsOrder: [],
      columnsSort: {},
      columnsWidth: [],
      columnsEditor: [],
      options: {},
      fitColumns: false
    }, modelEtc.state
    
    //Create translation configuration and interlinking configuration objects 
    
    );
    this.state = new recline.Model.ObjectState(state);

    this._slickHandler = new Slick.EventHandler();

    //add menu for new row , check if enableAddRow is set to true or not set
    if(this.state.get("gridOptions") 
  && this.state.get("gridOptions").enabledAddRow != undefined 
      && this.state.get("gridOptions").enabledAddRow == true ){
      this.editor    =  new  my.GridControl()
      this.elSidebar =  this.editor.$el
  this.listenTo(this.editor.state, 'change', function(){   
    this.model.records.add(new recline.Model.Record())
      });
    }
  },

  onRecordChanged: function(record) {
    // Ignore if the grid is not yet drawn
    if (!this.grid) {
      return;
    }
    // Let's find the row corresponding to the index
    var row_index = this.grid.getData().getModelRow( record );
    this.grid.invalidateRow(row_index);
    this.grid.getData().updateItem(record, row_index);
    this.grid.render();
    this.model.save();
  },

  render: function() {
    var self = this;
    var options = _.extend({
      enableCellNavigation: true,
      enableColumnReorder: true,
      explicitInitialization: true,
      syncColumnCellResize: true,
      forceFitColumns: this.state.get('fitColumns')
    }, self.state.get('gridOptions'));

    // We need all columns, even the hidden ones, to show on the column picker
    var columns = []; 

    // custom formatter as default one escapes html
    // plus this way we distinguish between rendering/formatting and computed value (so e.g. sort still works ...)
    // row = row index, cell = cell index, value = value, columnDef = column definition, dataContext = full row values
    var formatter = function(row, cell, value, columnDef, dataContext) {
      if(columnDef.id == "del"){
        return self.templates.deleterow 
      }
      var field = self.model.fields.get(columnDef.id);
      if (field.renderer) {
        return  field.renderer(value, field, dataContext);
      } else {
        return  value 
      }
    };

    // we need to be sure that user is entering a valid  input , for exemple if 
    // field is date type and field.format ='YY-MM-DD', we should be sure that 
    // user enter a correct value 
    var validator = function(field) {
      return function(value){
        if (field.type == "date" && isNaN(Date.parse(value))){
          return {
            valid: false,
            msg: "A date is required, check field field-date-format"
          };
        } else {
          return {valid: true, msg :null } 
        }
      }
    };

    // Add column for row reorder support
    if (this.state.get("gridOptions") && this.state.get("gridOptions").enableReOrderRow == true) {
      columns.push({
        id: "#",
        name: "",
        width: 22,
        behavior: "selectAndMove",
        selectable: false,
        resizable: false,
        cssClass: "recline-cell-reorder"
      })
    }
    // Add column for row delete support
    if (this.state.get("gridOptions") && this.state.get("gridOptions").enabledDelRow == true) {
      columns.push({
        id: 'del',
        name: '',
        field: 'del',
        sortable: true,
        width: 38,
        formatter: formatter,
        validator:validator
      })
    }

    function sanitizeFieldName(name) {
      var sanitized = $(name).text();
      return (name !== sanitized && sanitized !== '') ? sanitized : name;
    }

    //Hiding columns which are under undergoing interlinking. To do so fields
    // which are target of interlinking are included to the 
    // state.hiddenColumns[] array
    
    var hiddenColumns = []
    for(var i=0; i < this.model.fields.length; i++){  
    	if(this.model.fields.at(i).get("isInterlinked") === true)
    		hiddenColumns.push(this.model.fields.at(i).id);
    }
    hiddenColumns.concat(self.state.get('hiddenColumns'));
    hiddenColumns = uniqueArray(hiddenColumns);
    self.state.set('hiddenColumns',hiddenColumns);   
   
    _.each(this.model.fields.toJSON(),function(field){
      var column = {
        id: field.id,
        name: sanitizeFieldName(field.label),
        field: field.id,
        sortable: true,
        minWidth: 80,
        formatter: formatter,
        validator:validator(field)
      };
      if (field.hostsInterlinkingResults === true)
    	  column.cssClass = "interlinkingResults";
      if (field.hostsInterlinkingScores === true)
    	  column.cssClass = "interlinkingScore";
            
      var widthInfo = _.find(self.state.get('columnsWidth'),function(c){return c.column === field.id;});
      if (widthInfo){
        column.width = widthInfo.width;
      }
      var editInfo = _.find(self.state.get('columnsEditor'),function(c){return c.column === field.id;});
      if (editInfo){
        column.editor = editInfo.editor;
      } else {
        // guess editor type
        var typeToEditorMap = {
          'string': Slick.Editors.LongText,
          'integer': Slick.Editors.IntegerEditor,
          'number': Slick.Editors.Text,
          // TODO: need a way to ensure we format date in the right way
          // Plus what if dates are in distant past or future ... (?)
          // 'date': Slick.Editors.DateEditor,
          'date': Slick.Editors.Text,
          'boolean': Slick.Editors.YesNoSelectEditor
          // TODO: (?) percent ...
          };
          if (field.type in typeToEditorMap) {
           column.editor = typeToEditorMap[field.type]
          } else {
           column.editor = Slick.Editors.LongText;
          }
        }
        columns.push(column);
    });    
        
    // Restrict the visible columns
    var visibleColumns = _.filter(columns, function(column) {
      return _.indexOf(self.state.get('hiddenColumns'), column.id) === -1;
    });
    // Order them if there is ordering info on the state
    if (this.state.get('columnsOrder') && this.state.get('columnsOrder').length > 0) {
      visibleColumns = visibleColumns.sort(function(a,b){
        return _.indexOf(self.state.get('columnsOrder'),a.id) > _.indexOf(self.state.get('columnsOrder'),b.id) ? 1 : -1;
      });
      columns = columns.sort(function(a,b){
        return _.indexOf(self.state.get('columnsOrder'),a.id) > _.indexOf(self.state.get('columnsOrder'),b.id) ? 1 : -1;
      });
    }

    // Move hidden columns to the end, so they appear at the bottom of the
    // column picker
    var tempHiddenColumns = [];
    for (var i = columns.length -1; i >= 0; i--){
      if (_.indexOf(_.pluck(visibleColumns,'id'),columns[i].id) === -1){
        tempHiddenColumns.push(columns.splice(i,1)[0]);
      }
    }
    columns = columns.concat(tempHiddenColumns);

    // Transform a model object into a row
    function toRow(m) {

      var row = {};
      self.model.fields.each(function(field) {
        var render = "";
        //when adding row from slickgrid the field value is undefined
        if(!_.isUndefined(m.getFieldValueUnrendered(field))){
           render =m.getFieldValueUnrendered(field)
        }
        row[field.id] = render
      });

      return row;
    }

    function RowSet() {
      var models = [];
      var rows = [];

      this.push = function(model, row) {
        models.push(model);
        rows.push(row);
      };

      this.getLength = function() {return rows.length; };
      this.getItem = function(index) {return rows[index];};
      this.getItemMetadata = function(index) {return {};};
      this.getModel = function(index) {return models[index];};
      this.getModelRow = function(m) {return _.indexOf(models, m);};
      this.updateItem = function(m,i) {
        rows[i] = toRow(m);
        models[i] = m;
      };
    }

    var data = new RowSet();

    this.model.records.each(function(doc){
      data.push(doc, toRow(doc));
    });

    this.grid = new Slick.Grid(this.el, data, visibleColumns, options);
    // Column sorting
    var sortInfo = this.model.queryState.get('sort');
    if (sortInfo){
      var column = sortInfo[0].field;
      var sortAsc = sortInfo[0].order !== 'desc';
      this.grid.setSortColumn(column, sortAsc);
    }

    if (this.state.get("gridOptions") && this.state.get("gridOptions").enableReOrderRow) {
      this._setupRowReordering();
    }
    
    this._slickHandler.subscribe(this.grid.onSort, function(e, args){
      var order = (args.sortAsc) ? 'asc':'desc';
      var sort = [{
        field: args.sortCol.field,
        order: order
      }];
      self.model.query({sort: sort});
    });
    
    this._slickHandler.subscribe(this.grid.onColumnsReordered, function(e, args){
      self.state.set({columnsOrder: _.pluck(self.grid.getColumns(),'id')});
    });
    
    this.grid.onColumnsResized.subscribe(function(e, args){
        var columns = args.grid.getColumns();
        var defaultColumnWidth = args.grid.getOptions().defaultColumnWidth;
        var columnsWidth = [];
        _.each(columns,function(column){
          if (column.width != defaultColumnWidth){
            columnsWidth.push({column:column.id,width:column.width});
          }
        });
        self.state.set({columnsWidth:columnsWidth});
    });
    
    this._slickHandler.subscribe(this.grid.onCellChange, function (e, args) {
      // We need to change the model associated value	
      var grid = args.grid;
      var model = data.getModel(args.row);
      var field = grid.getColumns()[args.cell].id;
      var v = {};
      v[field] = args.item[field];
      model.set(v);
    });  
    this._slickHandler.subscribe(this.grid.onClick,function(e, args){
      //try catch , because this fail in qunit , but no
      //error on browser.
      try{e.preventDefault()}catch(e){}

      // The cell of grid that handle row delete is The first cell (0) if
      // The grid ReOrder is not present ie  enableReOrderRow == false
      // else it is The the second cell (1) , because The 0 is now cell
      // that handle row Reoder.
      var cell =0
      if(self.state.get("gridOptions") 
  && self.state.get("gridOptions").enableReOrderRow != undefined 
        && self.state.get("gridOptions").enableReOrderRow == true ){
        cell =1
      }
      if (args.cell == cell && self.state.get("gridOptions").enabledDelRow == true){
          // We need to delete the associated model
          var model = data.getModel(args.row);
          model.destroy()
        }
    }) ;
    var columnpicker = new Slick.Controls.ColumnPicker(columns, this.grid,
                                                       _.extend(options,{state:this.state}));
    if (self.visible){
      self.grid.init();
      self.rendered = true;
    } else {
      // Defer rendering until the view is visible
      self.rendered = false;
    }
       
    // Style column headers in respect with the way they are interlinked
    
    refreshCSS(this.model.fields);
    return this;
  },
  
  // Row reordering support based on
  // https://github.com/mleibman/SlickGrid/blob/gh-pages/examples/example9-row-reordering.html
  _setupRowReordering: function() {
    var self = this;
    self.grid.setSelectionModel(new Slick.RowSelectionModel());

    var moveRowsPlugin = new Slick.RowMoveManager({
      cancelEditOnDrag: true
    });

    moveRowsPlugin.onBeforeMoveRows.subscribe(function (e, data) {
      for (var i = 0; i < data.rows.length; i++) {
        // no point in moving before or after itself
        if (data.rows[i] == data.insertBefore || data.rows[i] == data.insertBefore - 1) {
          e.stopPropagation();
          return false;
        }
      }
      return true;
    });
    
    moveRowsPlugin.onMoveRows.subscribe(function (e, args) {
      var extractedRows = [], left, right;
      var rows = args.rows;
      var insertBefore = args.insertBefore;

      var data = self.model.records.toJSON()      
      left = data.slice(0, insertBefore);
      right= data.slice(insertBefore, data.length);
      
      rows.sort(function(a,b) { return a-b; });

      for (var i = 0; i < rows.length; i++) {
          extractedRows.push(data[rows[i]]);
      }

      rows.reverse();

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row < insertBefore) {
          left.splice(row, 1);
        } else {
          right.splice(row - insertBefore, 1);
        }
      }

      data = left.concat(extractedRows.concat(right));
      var selectedRows = [];
      for (var i = 0; i < rows.length; i++)
        selectedRows.push(left.length + i);      

      self.model.records.reset(data)
      
    });
    //register The plugin to handle row Reorder
    if(this.state.get("gridOptions") && this.state.get("gridOptions").enableReOrderRow) {
      self.grid.registerPlugin(moveRowsPlugin);
    }
  },

  remove: function () {
    this._slickHandler.unsubscribeAll();
    Backbone.View.prototype.remove.apply(this, arguments);
  },

  show: function() {
    // If the div is hidden, SlickGrid will calculate wrongly some
    // sizes so we must render it explicitly when the view is visible
    if (!this.rendered){
      if (!this.grid){
        this.render();
      }
      this.grid.init();
      this.rendered = true;
    }
    this.visible = true;
  },

  hide: function() {
    this.visible = false;
  }
});

// Add new grid Control to display a new row add menu bouton
// It display a simple side-bar menu ,for user to add new 
// row to grid 
my.GridControl= Backbone.View.extend({
  className: "recline-row-add",
  // Template for row edit menu , change it if you don't love
  template: '<h1><a href="#" class="recline-row-add btn">Add row</a></h1>',
  
  initialize: function(options){
    var self = this;
    _.bindAll(this, 'render');
    this.state = new recline.Model.ObjectState();
    this.render();
  },

  render: function() {
    var self = this;
    this.$el.html(this.template)
  },

  events : {
    "click .recline-row-add" : "addNewRow"
  },

  addNewRow : function(e){
    e.preventDefault()
    this.state.trigger("change")
 }
});

})(jQuery, recline.View);

/*
* Context menu for the column picker, adapted from
* http://mleibman.github.com/SlickGrid/examples/example-grouping
*
*/
(function ($) {
  var similarityResults = {};
  var selectedColumnIndex;
  var selectedField;
  function SlickColumnPicker(columns, grid, options) {
    var $menu;
    var columnCheckboxes;
    

    var defaults = {
      fadeSpeed:250
    };

    function init() {
      grid.onHeaderContextMenu.subscribe(handleHeaderContextMenu);
      grid.onClick.subscribe(handleCellClick);
      options = $.extend({}, defaults, options);
    }
    
    //This function handles clicks on columns which contain interlinking results
    function handleCellClick(e, args){
        e.preventDefault();
        selctedCell = args;
    	var model = window.multiview.model;
    	var fields = model.fields;
        var fieldID = grid.getColumns()[selctedCell.cell].field;
        var model = window.multiview.model;
        selectedField = model.fields.get(fieldID);        
        
    	if(selectedField.get("hostsInterlinkingResults")){
    		// A context menu is loaded containing other alternatives
    		//TODO: getting results with an AJAX call
    		
    		var originalFieldId = fields.at(fields.indexOf(selectedField) - 1).id;
            var ul = $("#termsMenu");
            ul.empty();
            var originalValue = model.records.at(selctedCell.row).get(similarityResults[originalFieldId].field)
            var bestResults = JSON.parse(similarityResults[originalFieldId].results[selctedCell.row].terms);

            ul.append('<b>Choices:</b>')
            ul.append('<li id="originalOption">Original Value: ' + originalValue + '</li> <hr />')
            $.each(bestResults, function (idx, item){
            	ul.append('<li id="termOption" term="' + item.term + '" score="' + item.score + '">' +
            		 item.term + "   (score: "+ (item.score*100) +"%)" + "</li>");
            })
            ul.append('<hr /><li id="finalizeOption">Finalize interlinking</li>');
            ul.append('<hr /><li id="abortOption" class="abort">Abort interlinking</li>');
            
            $("#termsMenu")
            	.css("top", e.pageY)
            	.css("left", e.pageX)
            	.show();
            
        	$("body").click(function(e) {
        	    if (!$(e.target).hasClass("slick-cell")){
        	    	$("#termsMenu").hide();
        	    }
        	});
            
    	} else{
            $("body").one("click", function () {
                $("#termsMenu").hide();
             });
    	}
    	
    }

    function handleHeaderContextMenu(e, args) {
        e.preventDefault();
        var model = window.multiview.model;
        if(e.target.id != ""){
          selectedColumnHeader = e.target;
        }
        else{
          selectedColumnHeader = $(e.target).parent();
        }
        header = {}
        header.id = args.column.id;
        header.field = args.column.field;
        
        selectedColumnIndex = grid.getColumnIndex(header.id)
        if(options.enableReOrderRow)
        	selectedColumnIndex--;

        if(options.enabledDelRow)
        	selectedColumnIndex--;
                
        selectedField = model.fields.get(grid.getColumns()[selectedColumnIndex]);
     
        console.log(selectedField)
        if (	selectedField.get("hostsInterlinkingScores") === true ||
        		selectedField.get("isInterlinked") === true){
          return;
        }else if (selectedField.get("hostsInterlinkingResults") === true){
	        origColumn = grid.getColumns()[selectedColumnIndex];
	        // set the grid's columns as the new columns
	        $("#interlinkingHandling")
	           .css("top", e.pageY)
	           .css("left", e.pageX)
	           .show();
	
	        $("body").one("click", function () {
	          $("#interlinkingHandling").hide();
	        });
        }else{
	        origColumn = grid.getColumns()[selectedColumnIndex];
	        // set the grid's columns as the new columns
	        $("#interlinkingChoices")
	           .css("top", e.pageY)
	           .css("left", e.pageX)
	           .show();
	
	        $("body").one("click", function () {
	          $("#interlinkingChoices").hide();
	        });
        }
    }
    
    $("#interlinkingHandling").off('click').click(function (e) {
    	if (!$(e.target).is("li")) {
            return;
        }  
    	if (!grid.getEditorLock().commitCurrentEdit()) {
            return;
        }
    	var model = window.multiview.model;
    	var fields = model.fields;
    	var row = selctedCell.row;
    	var col = selctedCell.cell;
    	var record = Object.create(model.records.models[row]);
		var intFieldId = selectedField.id;
		var scoreFieldId = fields.at(fields.indexOf(selectedField) + 1).id;
		var originalFieldId = fields.at(fields.indexOf(selectedField) - 1).id;
		
		
    	if (e.target.id == "finalizeOption"){
    		var newColumns = grid.getColumns().slice(0);
    		var interlinkedColumn = Object.create(grid.getColumns()[col]);
    		var originalField = fields.at(fields.indexOf(selectedField) - 1);
    		
    		interlinkedColumn.name = interlinkedColumn.name.substr(0,interlinkedColumn.name.length -4);
    		interlinkedColumn.id = interlinkedColumn.id.substr(0,interlinkedColumn.id.length -4);
    		interlinkedColumn.cssClass = "";
    		
    		newColumns.splice(col, 2, interlinkedColumn);
    		grid.setColumns(newColumns);
    		
    		fields.remove([{id: originalField.id}]);
    		fields.remove([{id: scoreFieldId}]);
    		
    		//fields.get(intFieldId).set({id: "id"});
    		//interlinkedColumn.field = interlinkedColumn.field.substr(0,interlinkedColumn.field.length -4);
    		    		
    		fields.get(intFieldId).set("hostsInterlinkingResults", false);
    		fields.get(intFieldId).set("interlinkRefDataCategory", null);
    		refreshCSS(model.fields);
    		
    	}else if (e.target.id == "abortOption"){
    		var newColumns = grid.getColumns().slice(0);
    		var originalColumn = Object.create(grid.getColumns()[col]);
    		// The original column is created copying the target interliked one and 
    		//changing fields "id", "name", "field" 
    		originalColumn.id = grid.getColumns()[col].id.substr(0,grid.getColumns()[col].id.length -4);
    		originalColumn.name = grid.getColumns()[col].name.substr(0,grid.getColumns()[col].name.length -4);
    		originalColumn.field = grid.getColumns()[col].field.substr(0,grid.getColumns()[col].field.length -4);
    		originalColumn.cssClass = "";
    		// The original column replaces both the interlinked one and the one hosting scores
    		newColumns.splice(col, 2, originalColumn);    	   
    	    grid.setColumns(newColumns);
    	    
    	    // Now we handle the model removing the interlinked results field and the 
    	    //interliking scores one.
    	    fields.remove([{id: intFieldId},{id: scoreFieldId}]);
    	    var originalField = fields.get(originalColumn.field)
    	    // deleting attributes related with interlinking
    	    originalField.set("isInterlinked", false);
    	    originalField.set("interlinkRefDataCategory", null);
    		refreshCSS(model.fields);
    		//TODO change refreshCSS make it working with fields list
    	}
    });
    
    $("#termsMenu").off('click').click(function (e) {
    	if (!$(e.target).is("li")) {
            return;
        }  
    	if (!grid.getEditorLock().commitCurrentEdit()) {
            return;
        }
    	var model = window.multiview.model;
    	var fields = model.fields;
    	var row = selctedCell.row;
    	var col = selctedCell.cell;
    	var record = Object.create(model.records.models[row]);
		var intFieldId = selectedField.id;
		var scoreFieldId = fields.at(fields.indexOf(selectedField) + 1).id;
		var originalFieldId = fields.at(fields.indexOf(selectedField) - 1).id;
		
		
    	if (e.target.id == "originalOption"){
    		var originalValue = model.records.at(row).get(similarityResults[originalFieldId].field)
    		record.set(intFieldId, originalValue);
    		record.set(scoreFieldId, ' - ');    		
        	grid.getData().updateItem(record,row);
        	grid.updateRow(row);
    		grid.render();
    	}else if (e.target.id == "termOption"){
    		record.set(intFieldId, $(e.target).attr('term'));
    		//TODO: instead of updating score field with a string (80%), update it with a value 
    		//(e.g. 0.8) and make sure that it is properly handled by the column handler.
    		record.set(scoreFieldId, ($(e.target).attr('score')*100)+"%");
        	grid.getData().updateItem(record,row);
        	grid.updateRow(row);
    		grid.render();
    	}else if (e.target.id == "finalizeOption"){
    		var newColumns = grid.getColumns().slice(0);
    		var interlinkedColumn = Object.create(grid.getColumns()[col]);
    		var originalField = fields.at(fields.indexOf(selectedField) - 1);
    		
    		interlinkedColumn.name = interlinkedColumn.name.substr(0,interlinkedColumn.name.length -4);
    		interlinkedColumn.id = interlinkedColumn.id.substr(0,interlinkedColumn.id.length -4);
    		interlinkedColumn.cssClass = "";
    		
    		newColumns.splice(col, 2, interlinkedColumn);
    		grid.setColumns(newColumns);
    		
    		fields.remove([{id: originalField.id}]);
    		fields.remove([{id: scoreFieldId}]);
    		
    		//fields.get(intFieldId).set({id: "id"});
    		//interlinkedColumn.field = interlinkedColumn.field.substr(0,interlinkedColumn.field.length -4);
    		    		
    		fields.get(intFieldId).set("hostsInterlinkingResults", false);
    		fields.get(intFieldId).set("interlinkRefDataCategory", null);
    		refreshCSS(model.fields);
    		
    	}else if (e.target.id == "abortOption"){
    		var newColumns = grid.getColumns().slice(0);
    		var originalColumn = Object.create(grid.getColumns()[col]);
    		// The original column is created copying the target interliked one and 
    		//changing fields "id", "name", "field" 
    		originalColumn.id = grid.getColumns()[col].id.substr(0,grid.getColumns()[col].id.length -4);
    		originalColumn.name = grid.getColumns()[col].name.substr(0,grid.getColumns()[col].name.length -4);
    		originalColumn.field = grid.getColumns()[col].field.substr(0,grid.getColumns()[col].field.length -4);
    		originalColumn.cssClass = "";
    		// The original column replaces both the interlinked one and the one hosting scores
    		newColumns.splice(col, 2, originalColumn);    	   
    	    grid.setColumns(newColumns);
    	    
    	    // Now we handle the model removing the interlinked results field and the 
    	    //interliking scores one.
    	    fields.remove([{id: intFieldId},{id: scoreFieldId}]);
    	    var originalField = fields.get(originalColumn.field)
    	    // deleting attributes related with interlinking
    	    originalField.set("isInterlinked", false);
    	    originalField.set("interlinkRefDataCategory", null);
    		refreshCSS(model.fields);
    		//TODO change refreshCSS make it working with fields list
    	}
    });

    $("#interlinkingChoices").off('click').click(function (e) {
        if (!$(e.target).is("li")) {
            return;
        }      
        if (!grid.getEditorLock().commitCurrentEdit()) {
            return;
        }
        var model = window.multiview.model;

        if(e.target.id == "placenames"){
            selectedField.interlinkRefDataCategory = "placename";
        } else if(e.target.id == "addresses"){
            selectedField.interlinkRefDataCategory = "address";
        } else if(e.target.id == "postal_codes"){
            selectedField.interlinkRefDataCategory = "postalcode";
        } 
        
      
        //Two new fields will be created in the data model and two respective columns in the grid 
        //	One will host the interlinking results and one their respective similarity scores
        
        //First the new fields are created
        var intFieldID = header.field + "_int";
        var scoreFieldID = intFieldID + "_score";
        
        //first we create a fields object to define our new fields
        var fields = model.fields;

        var selectedFieldIndex = fields.indexOf(selectedField);
        
        fields.add({id: intFieldID},{at:selectedFieldIndex + 1});
        intField = fields.get(intFieldID);
        
        fields.add({id: scoreFieldID, label:"% score"},{at:selectedFieldIndex + 2});
        scoreField = fields.get(scoreFieldID);
        
        // Marking the new fields as fields hosting interlinked results and scores 
        selectedField.set("isInterlinked", true);
        intField.set("hostsInterlinkingResults", true);
        scoreField.set("hostsInterlinkingScores", true);
        intField.set("interlinkRefDataCategory", selectedField.interlinkRefDataCategory);       
                
        // Now two new columns have to be created in the grid respective to the new fields
        //The first one is a copy of the original one
        var intColumn = $.extend(true,{},origColumn); 
        intColumn.id = origColumn.id+"_int";
        intColumn.name = origColumn.name+"_int";
        intColumn.field = origColumn.field+"_int";
        intColumn.cssClass = "interlinkingResults";
        
        var scoreColumn = {id: scoreFieldID, name: "% score", field: scoreFieldID, sortable: true, cssClass: "interlinkingScore"};
        scoreColumn.isDerivative = true;
        
        grid.getColumns()[selectedColumnIndex].getting_interlinked = true;
        var newColumns = grid.getColumns().slice(0);
        
        // The original column is replaced by the two new ones 
        newColumns.splice(selectedColumnIndex, 1, intColumn, scoreColumn);
        
        grid.setColumns(newColumns);

        ////fill the new fields with the best interlinked data and the respective scores
    	//At this point it is supposed that an api call is done to retrieve the requested data
       
        // TODO: similarityResults is currently a global object but either it will be part of the data model 
        	// or its contents will be loaded as table columns using a fetch() command 
        similarityResults[header.field] = createIntrlinkedResults(header.field, model.records.pluck("id"), model.records.length);
        
        
        //TODO: this process must run not only on the model but at the backend as well in order to be 
        	//	applied not only for the first 100 rows the model carries but to the whole field
        for (var i = 0; i < model.records.length; i++){
        	var record  = Object.create(model.records.models[i]);
        	////matches = _.find(similarityResults,function(e){ return e.id == model.records.at(i).id; })
        	////bestMatch = _.max(matches.terms,function(e){ return e.score; })
        	////record.set(intFieldID, bestMatch.term)
        	record.set(intFieldID, similarityResults[header.field].results[i].bestTerm);
        	//TODO use (or create) percentage formatter        	
        	////record.set(scoreFieldID,(bestMatch.score*100)+"%")
        	record.set(scoreFieldID, similarityResults[header.field].results[i].bestScore*100+"%");
        	grid.getData().updateItem(record,i);
        	grid.updateRow(i);
        }      
        //grid.render();
        refreshCSS(model.fields);
    });
    init();
  }

  // Slick.Controls.ColumnPicker
  $.extend(true, window, {
    Slick: {
      Controls: {
        ColumnPicker: SlickColumnPicker
      }
    }
  });

})(jQuery);

// Reads the model and assigns proper CSS to respective elements
/*
function refreshCSS(models){
	for(var i=0 ; i < models.length; i++){
        // Coloring column headers as an indication to the way they are interlinked 
		if (models[i].get("interlinkRefDataCategory") == "placename"){
            $("[model_id='"+ models[i].id +"']").addClass("placename");
        }else if (models[i].get("interlinkRefDataCategory") == "address"){
            $("[model_id='"+ models[i].id +"']").addClass("address");
        }else if (models[i].get("interlinkRefDataCategory") == "postalcode"){
            $("[model_id='"+ models[i].id +"']").addClass("postalcode");
        }         
    } 
}
*/

function refreshCSS(fields){	
	for(var i=0 ; i < fields.length; i++){
        // Coloring column headers as an indication to the way they are interlinked 
		if (fields.at(i).get("interlinkRefDataCategory") == "placename"){
            $("[model_id='"+ fields.at(i).get("id") +"']").addClass("placename");
        }else if (fields.at(i).get("interlinkRefDataCategory") == "address"){
            $("[model_id='"+ fields.at(i).id +"']").addClass("address");
        }else if (fields.at(i).get("interlinkRefDataCategory") == "postalcode"){
            $("[model_id='"+ fields.at(i).id +"']").addClass("postalcode");
        }         
    } 
}

function createIntrlinkedResults (field, ids, size){
	//var text = '{"results":[{"id":"0","terohn Carpenterms":[{"term":"a0","score":0.98},{"term":"a1","score":0.85},{"term":"a2","score":0.68}]},{"id":"1","terms":[{"term":"b0","score":0.98},{"term":"b1","score":0.85},{"term":"b2","score":0.68}]},{"id":"2","terms":[{"term":"c0","score":0.98},{"term":"bc1","score":0.85},{"term":"c2","score":0.68}]}]}';
	var reply = {}
	reply.field = field;
	
	reply.results = []
	
	for(var i=0;i<size;i++){
		var item = {}
		item.id = ids[i];
		//item.terms = []
		item.bestTerm = 'term'+i+'_'+'0'+'_'+field;
		item.bestScore = 0.9;
		item.terms = '[';
		for(var j=0;j<5;j++){
			/*
			var term = {}
			term.term = "term"+i+"_"+j + ;
			term.score = 0.9-j*0.1;
			item.terms.push(term);
			*/
			var t = '{"term":"'+'term'+i+'_'+j+'_'+field+'","score":'+(0.9-j*0.1)+'}';
			if(j < 4)
				t = t +',';
			item.terms = item.terms + t;
		}
		item.terms = item.terms + ']';
		reply.results.push(item);
	}
	return reply;
}

function uniqueArray(input) {
	var u = {}, a = [];
	for(var i = 0, l = input.length; i < l; ++i){
		if(u.hasOwnProperty(input[i])) {
			continue;
	    }
	    a.push(input[i]);
	    u[input[i]] = 1;
	}
	return a;
}


