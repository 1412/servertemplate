var sequelizetask = ["%", {
	ref: "addmin_privilege",
	task: "create",
	table: "Privilege",
	continueOnError: false,
	data: {
		title: "ENTER_ADMIN_PAGE",
		grant: true
	}
}, {
	ref: "doctor_privilege",
	task: "create",
	table: "Privilege",
	continueOnError: false,
	data: {
		title: "ENTER_DOCTOR_PAGE",
		grant: true
	}
}, {
	ref: "receiptionist_privilege",
	task: "create",
	table: "Privilege",
	continueOnError: false,
	data: {
		title: "ENTER_RECEIPTIONIST_PAGE",
		grant: true
	}
}, {
	ref: "admin_role",
	task: "build",
	table: "UserRole",
	data: {
		title: "Super Admin"
	}
}, {
	ref: "doctor_role",
	task: "build",
	table: "UserRole",
	data: {
		title: "Doctor"
	}
}, {
	ref: "receiptionist_role",
	task: "build",
	table: "UserRole",
	data: {
		title: "Receiptionist"
	}
}, "&", {
	ref: "doctor_user",
	task: "build",
	table: "User",
	data: {
		username: "doctor",
		password: require('crypto').createHash('md5').update("doctor").digest('hex'),
		enabled: true,
		email: "doctor@yourhost.com"
	}
}, {
	ref: "receiptionist_user",
	task: "build",
	table: "User",
	data: {
		username: "ika",
		password: require('crypto').createHash('md5').update("ika").digest('hex'),
		enabled: true,
		email: "ika@yourhost.com"
	}
}, {
	ref: "doctor1",
	task: "create",
	table: "Doctor",
	continueOnError: false,
	data: {
		name: "Doctor Admin",
		degree: "Drg. Dr. Mdg. MKes.",
		phone: "081914773295",
		address: "Jalan simalakama",
		email: "admin@yourhost.com",
		gender: "L",
		birthDate: new Date(),
		birthPlace: "Your Heart"
	}
}, {
	ref: "doctor2",
	task: "create",
	table: "Doctor",
	continueOnError: false,
	data: {
		name: "Doctor Sahid",
		degree: "Drg.",
		phone: "081914773295",
		address: "Jalan simalakama",
		email: "sahid@yourhost.com",
		gender: "L",
		birthDate: new Date(),
		birthPlace: "Somewhere"
	}
}, {
	ref: "patient",
	task: "create",
	table: "Patient",
	continueOnError: false,
	data: {
		name: "Budiman",
		phone: "081914773295",
		address: "Jalan simalakama",
		jobs: "Pengangguran",
		specialCondition: "Sick",
		alergic: "Telur",
		gender: "L",
		birthDate: new Date(),
		birthPlace: "Your Heart"
	}
}, {
	ref: "treatment",
	task: "build",
	table: "Treatment",
	data: {
		name: "Operasi",
		cost: 1000000
	}
}, {
	ref: "medicine",
	task: "build",
	table: "Medicine",
	data: {
		name: "Puyer 16",
		code: "py16",
		dosage: "1/3",
		cost: 10000,
		inStock: 30
	}
}, "#", {
	ref: "admin_role_saved",
	task: "save",
	use: "admin_role"
}, {
	ref: "admin_role_set_privileges",
	task: "relate",
	use: "admin_role_saved",
	set: "Privilege",
	dataref: ["addmin_privilege", "doctor_privilege", "receiptionist_privilege"]
}, {
	ref: "doctor_role_saved",
	task: "save",
	use: "doctor_role"
}, {
	ref: "doctor_role_set_privileges",
	task: "relate",
	use: "doctor_role_saved",	
	set: "Privilege",
	dataref: ["doctor_privilege"]
}, {
	ref: "receiptionist_role_saved",
	task: "save",
	use: "receiptionist_role"
}, {
	ref: "receiptionist_role_set_privileges",
	task: "relate",
	use: "receiptionist_role_saved",
	set: "Privilege",
	dataref: ["receiptionist_privilege"]
}, {
	ref: "admin_user_saved",
	task: "save",
	use: "admin_user"
}, {
	ref: "admin_user_set_doctor",
	task: "relate",
	use: "admin_user_saved",
	set: "Doctor",
	dataref: "doctor1"
}, {
	ref: "admin_user_set_role",
	task: "relate",
	use: "admin_user_saved",
	set: "UserRole",
	dataref: "admin_role"
}, {
	ref: "doctor_user_saved",
	task: "save",
	use: "doctor_user"
}, {
	ref: "doctor_user_set_doctor",
	task: "relate",
	use: "doctor_user_saved",
	set: "Doctor",
	dataref: "doctor2"
}, {
	ref: "doctor_user_set_role",
	task: "relate",
	use: "doctor_user_saved",
	set: "UserRole",
	dataref: "doctor_role"
}, {
	ref: "receiptionist_user_saved",
	task: "save",
	use: "receiptionist_user"
}, {
	ref: "receiptionist_user_set_role",
	task: "relate",
	use: "receiptionist_user_saved",
	set: "UserRole",
	dataref: "receiptionist_role"
}]

var posistions = ["UL", "UR", "DR", "DL"];
for (var pos in posistions) {
	for (var i = 1; i <= 8; i++) {
		sequelizetask.splice(sequelizetask.indexOf("#"), 1, {
			ref: "teeth" + posistions[pos] + i,
			task: "create",
			table: "TeethTreatment",
			continueOnError: false,
			data: {
				name: posistions[pos] + "_" + i,
				position: posistions[pos],
				number: i,
				cost: 1000
			}
		});
	}
}


module.exports = sequelizetask;