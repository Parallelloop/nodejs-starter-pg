import xlsx from 'xlsx';
import path from 'path';
import multer from 'multer';
import fs from 'fs';


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

export const upload = multer({ storage: storage });

// Mock function to simulate saving an image
const saveImage = (file) => {
    console.log("🚀 ~ saveImage ~ __dirname:", __dirname)
    return filePath;
};



// Mock function to simulate fetching general settings
const getGeneralSettings = () => {
    return { order_price: 100 };  // Example price
};

// Simulate database call for User authentication
const getUser = (req) => {
    return { id: 1 };  // Mock user ID
};

// Simulate creating a new order in the database
const createCustomerOrder = (data) => {
    // Simulate saving to a database
    return { ...data, id: Date.now() };
};

const uploadingFile = async (req, res) => {
    try {
        const { read_ppc_file, campaigns } = req.body;
        const { fieldname, path } = req.file
        console.log("🚀 ~ uploadingFile ~ req.file:", req.file)

        // const generalSettings = getGeneralSettings();
        // const user = getUser(req);

        if (read_ppc_file && path) {

            // const fileRecords = xlsx.utils.sheet_to_json(xlsx.readFile(path), { header: 1 });
            const rawFile = xlsx.readFile(path);
            console.log("🚀 ~ uploadingFile ~ sheet names:", rawFile.SheetNames);

            const sheet = rawFile.Sheets[rawFile.SheetNames[1]];
            const fileRecords = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            // console.log("🚀 ~ uploadingFile ~ fileRecords:", fileRecords)
            fileRecords.shift();

            const temp = [...new Set(fileRecords.map((row) => row[11]))];
            console.log("🚀 ~ uploadingFile ~ temp:", temp)
            const uniqueArr = fileRecords.filter((row) => temp.includes(row[11]));
            console.log("🚀 ~ uploadingFile ~ uniqueArr:", uniqueArr)

            uniqueArr.sort((a, b) => (a[11] < b[11] ? -1 : 1));

            return res.json({ records: uniqueArr });
        }

        // const data = { ...req.body, customer_id: user.id };

        // Handle the uploaded image if available
        // if (req.file) {
        //     data.customer_file_name = req.file.originalname;
        //     data.customer_file = saveImage(req.file);
        // }

        // const selectedCampaigns = campaigns || [];

        // // Read customer file and filter records
        // const fileRecords = xlsx.utils.sheet_to_json(xlsx.readFile(req.file.path), { header: 1 });
        // fileRecords.shift();

        // let records = fileRecords.filter((row) => row[13] === 'exact');

        // if (selectedCampaigns.length > 0) {
        //     records = records.filter((row) => selectedCampaigns.includes(row[3]));
        // }

        // data.amount = generalSettings.order_price * records.length;

        // Create order in the database
        // const record = createCustomerOrder(data);

        // Simulate saving metas
        // this.saveMetas(req, record);  // Implement this function as needed

        return res.status(200).json({ message: 'Record has been saved' });
    } catch (err) {
        return res.status(500).json(err.message);
    }
};

export default uploadingFile;

