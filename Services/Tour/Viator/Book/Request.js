let BookRequestTour = `
{
    "language": "###language###",
    "holder": {
        "name": "###name###",
        "surname": "###surname###",
        "email": "###email###",
        "phone": "###phone###"
    },
    "transfers": ###transfers###,
    "clientReference": "###clientReference###"
}
`;

let BookRequest = {

    request: async () => {
        return BookRequestTour;
    }

};

module.exports = BookRequest;