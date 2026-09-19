

const registerStudent = async (req, res) => {

    try{
        const {name, email, password} = req.body;
        const student = await Student.create({name, email, password});
        res.status(201).json(student);

    }catch(err){
        res.status(500).json({
            message: "Error registering student",
            error: err.message
        })
    }


}


export { registerStudent };