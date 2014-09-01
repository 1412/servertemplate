var SEQUELIZE = require('sequelize');
var MergeJSON = function(target){
	var sources = [].slice.call(arguments, 1);
	sources.forEach(function (source) {
		for (var prop in source) {
			target[prop] = source[prop];
		}
	});
	return target;
}
var schema = {
	__version: 1.0,
	// set sequelize table structure
	ApplicationInfo: {
		name: SEQUELIZE.STRING(100),
		version: SEQUELIZE.FLOAT(3),
		schemaVersion: SEQUELIZE.FLOAT(3),
		owner: SEQUELIZE.STRING(100),
		address: SEQUELIZE.STRING,
		note: SEQUELIZE.STRING(100)
	},
	UserRole: {
		title: SEQUELIZE.STRING(100),
		description: SEQUELIZE.TEXT,
		note: SEQUELIZE.STRING(100),
		__proto__: {
			getterMethods   : {
				privilegesFlat: function(){
					var privileges = this.privileges;
					var result = [];
					for (i in privileges) {
						result.push(privileges[i].title);
					}
					return result;
				},
				hasPrivilige: function(privilege){
					return (this.privilegesFlat.indexOf(privilege) > -1);
				}
			}
		} 
	},
	Privilege: {
		title: SEQUELIZE.STRING(50),
		note: SEQUELIZE.STRING(100)
	},
	User: {
		username: SEQUELIZE.STRING(100),
		password: SEQUELIZE.STRING(35),
		enabled: SEQUELIZE.BOOLEAN,
		email: SEQUELIZE.STRING(100),
		note: SEQUELIZE.STRING(100),
		__proto__: {
			getterMethods   : {
				role: function(){
					return this.userRole.title;
				},
				privilegesFlat: function(){
					return this.userRole.privilegesFlat;
				},
				hasPrivilige: function(privilege){
					return (this.privilegesFlat.indexOf(privilege) > -1);
				},
				isDoctor: function(){
					if (this.doctor === undefined) {
						return false;
					}
					if (this.doctor == null) {
						return false;
					}
					return true
				},
				flatData: function(){
					var result = {
						username: this.username,
						password: this.password,
						email: this.email,
						isDoctor: this.isDoctor,
						role: this.role,
						privileges: this.privilegesFlat
					};
					if (this.isDoctor) {
						var data = this.doctor;
						var doctordata = {
							name: data.name,
							degree: data.degree,
							phone: data.phone,
							address: data.address,
							email: data.email,
							gender: data.gender
						}
						result = MergeJSON(result, doctordata);
					}
					return result;
				}
			}
		}
	},
	Doctor: {
		name: SEQUELIZE.STRING(100),
		degree: SEQUELIZE.STRING(50),
		phone: SEQUELIZE.STRING(20),
		address: SEQUELIZE.STRING,
		email: SEQUELIZE.STRING(100),
		gender: SEQUELIZE.ENUM('L', 'P', 'O'),
		birthDate: SEQUELIZE.DATE,
		birthPlace: SEQUELIZE.STRING(100),
		note: SEQUELIZE.STRING(100)
	},
	Patient: {
		name: SEQUELIZE.STRING(100),
		gender: SEQUELIZE.ENUM('L', 'P', 'O'),
		birthDate: SEQUELIZE.DATE,
		birthPlace: SEQUELIZE.STRING(100),
		jobs: SEQUELIZE.STRING(100),
		specialCondition: SEQUELIZE.STRING(100),
		alergic: SEQUELIZE.STRING(100),
		note: SEQUELIZE.STRING(100)
	}, 
	PatientTreatment: {
		start: SEQUELIZE.DATE,
		finish: SEQUELIZE.DATE,
		diagnose: SEQUELIZE.STRING(100),
		therapy: SEQUELIZE.STRING(100),
		presumption: SEQUELIZE.STRING(100),
		discon: SEQUELIZE.INTEGER,
		charge: SEQUELIZE.INTEGER,
		payment: SEQUELIZE.INTEGER,
		paymentMethod: SEQUELIZE.STRING(20),
		isSettled: SEQUELIZE.BOOLEAN,
		note: SEQUELIZE.STRING(100)
	},
	CustomerQueue: {
		date: SEQUELIZE.DATE
	},
	TeethTreatment: {
		name: SEQUELIZE.STRING(50),
		position: SEQUELIZE.ENUM('UL', 'UR', 'DR', 'DL'),
		number: SEQUELIZE.INTEGER,
		cost: SEQUELIZE.INTEGER,
		note: SEQUELIZE.STRING(100)
	},
	Treatment: {
		name: SEQUELIZE.STRING(50),
		cost: SEQUELIZE.INTEGER,
		note: SEQUELIZE.STRING(100)
	},
	Medicine: {
		name: SEQUELIZE.STRING(50),
		code: SEQUELIZE.STRING(20),
		dosage: SEQUELIZE.STRING,
		cost: SEQUELIZE.INTEGER,
		inStock: SEQUELIZE.INTEGER,
		note: SEQUELIZE.STRING(100)
	},
	
	/*
		Set relation config
		format: {
			from: "Table Name",
			to: "Table Name",
			rel: "Relation"
		}
	*/
	__relation__: [{
		from: "UserRole",
		to: "UserRole",
		rel: "hasmany",
		options: { as: 'Childrens', foreignKey: 'ParentId', through: null }
	}, {
		from: "Privilege",
		to: "UserRole",
		rel: "hasmany"
	}, {
		from: "UserRole",
		to: "Privilege",
		rel: "hasmany"
	}, {
		from: "UserRole",
		to: "User",
		rel: "hasmany"
	}, {
		from: "User",
		to: "UserRole",
		rel: "hasone"
	}, {
		from: "Doctor",
		to: "User",
		rel: "belongsto"
	}, {
		from: "User",
		to: "Doctor",
		rel: "hasone"
	}, {
		from: "Patient",
		to: "CustomerQueue",
		rel: "hasmany"
	}, {
		from: "CustomerQueue",
		to: "Patient",
		rel: "hasone"
	}, {
		from: "Doctor",
		to: "CustomerQueue",
		rel: "hasmany"
	}, {
		from: "CustomerQueue",
		to: "Doctor",
		rel: "hasOne"
	}, {
		from: "Doctor",
		to: "PatientTreatment",
		rel: "hasmany"
	}, {
		from: "PatientTreatment",
		to: "Doctor",
		rel: "hasone"
	}, {
		from: "Treatment",
		to: "PatientTreatment",
		rel: "hasmany"
	}, {
		from: "PatientTreatment",
		to: "Treatment",
		rel: "hasone"
	}, {
		from: "TeethTreatment",
		to: "PatientTreatment",
		rel: "hasmany"
	}, {
		from: "PatientTreatment",
		to: "TeethTreatment",
		rel: "hasmany"
	}, {
		from: "Medicine",
		to: "PatientTreatment",
		rel: "hasmany"
	}, {
		from: "PatientTreatment",
		to: "Medicine",
		rel: "hasmany"
	}]
}
module.exports = schema;
