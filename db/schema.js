var SEQUELIZE = require('sequelize');
var schema = {
	__version: "0.0.1",
	// set sequelize table structure    

    /*
	TableName: {
		fields: SEQUELIZE_TYPE
	},
    */	
    
	__relation__: [
    /*
    {
		from: "", // source table name
		to: "",   // destination table name
		rel: "", // hasone, hasmany, belongsto
		options: { as: 'Childrens', foreignKey: 'ParentId', through: null }
	}
    */
    ]
}
module.exports = schema;
