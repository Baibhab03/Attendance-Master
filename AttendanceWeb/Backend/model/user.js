const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      sl_no: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      academic_uuid: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "users",
      timestamps: true, // createdAt & updatedAt
    }
  );

  return User;
};