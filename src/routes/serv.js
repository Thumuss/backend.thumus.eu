const express = require("express");

const router = express.Router();

router.get("/err", (req, res) => {
  res.render("err");
});
module.exports = router;
