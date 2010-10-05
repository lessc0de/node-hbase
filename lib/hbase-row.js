
var utils = require('./hbase-utils')
  , Table = require('./hbase-table');

var Row = function(hbase, table, key){
	this.hbase = hbase;
	this.table = typeof table === 'string' ? table : table.name;
	this.table = table;
	this.key = key;
}

//myRow.delete([column], [callback])
Row.prototype.delete = function(){
	var self = this
	  , args = Array.prototype.slice.call(arguments)
	  , key = '/'+this.table+'/'+this.key;
	if(typeof args[0] === 'string' || (typeof args[0] === 'object' && args[0] instanceof Array) ){
		key += '/'+args.shift();
	}
	this.hbase.connection.delete(key, function( error, success ){
		args[0].apply(self, [error, error? null: true]);
	},true);
}

//myRow.exists(column, [callback])
Row.prototype.exists = function(column, callback){
	var self = this
	  , args = Array.prototype.slice.call(arguments)
	  , key = '/'+this.table+'/'+this.key;
	if(typeof args[0] === 'string'){
		key += '/'+args.shift();
	}
	this.hbase.connection.get(key, function( error, exists ){
		// note:
		// if row does not exists: 404
		// if row exists and column family does not exists: 503
		if(error && ( error.code === 404 || error.code === 503 ) ){
			error = null;
			exists = false;
		}
		args[0].apply(
			self
		  , [ error, error ? null : ( exists === false ? false : true ) ] );
	},true);
}

//myRow.get([column], [callback])
Row.prototype.get = function(column, callback){
	var self = this
	  , args = Array.prototype.slice.call(arguments)
	  , key = '/'+this.table+'/'+this.key
	  , isGlob = this.key.substr(-1,1)==='*';
	if(typeof args[0] === 'string' || (typeof args[0] === 'object' && args[0] instanceof Array) ){
		key += '/'+args.shift();
	}
	this.hbase.connection.get(key, function( error, data ){
		if(error) return args[0].apply(self, [error, null] );
		var cells = [];
		data.Row.forEach(function(row){
			var key = utils.decode(row.key);
			row.Cell.forEach(function(cell){
				var data = {};
				if(isGlob){
					data.key = key;
				}
				data.column = utils.decode(cell.column);
				data.timestamp = cell.timestamp;
				data.$ = utils.decode(cell.$);
				cells.push( data )
			})
		});
		args[0].apply(self, [null, cells]);
	});
}

//myRow.put(column, value, [callback])
Row.prototype.put = function(columns, data, callback){
	var self = this;
	if(typeof columns === 'string'){
		columns = [columns];
		data = [data];
	}else{
		if(columns.length !== data.length){
			throw new Error('Columns count must match data count');
		}
	}
	var body = {'Row':[]};
	columns.forEach(function(column,i){
		body.Row.push({
			'key': utils.encode(self.key),
			'Cell': [{
				'column': utils.encode(column),
				'$': utils.encode(data[i])
			}]
		});
	})
	this.hbase.connection.put('/'+this.table+'/'+this.key+'/'+columns.join(','), body, function( error, data ){
		if(!callback) return;
		callback.apply(
			self
		  , [ error, error ? null : true ] )
	});
}

module.exports = Row;