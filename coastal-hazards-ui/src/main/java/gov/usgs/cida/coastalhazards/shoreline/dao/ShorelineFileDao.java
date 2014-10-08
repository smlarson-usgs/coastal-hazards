package gov.usgs.cida.coastalhazards.shoreline.dao;

import gov.usgs.cida.coastalhazards.shoreline.exception.ShorelineFileFormatException;
import gov.usgs.cida.utilities.features.Constants;

import java.io.File;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.text.ParseException;
import java.util.Date;
import java.util.Map;
import java.util.NoSuchElementException;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import javax.sql.DataSource;

import org.geotools.feature.SchemaException;
import org.opengis.referencing.FactoryException;
import org.opengis.referencing.operation.TransformException;
import org.slf4j.LoggerFactory;

/**
 *
 * @author isuftin
 */
public abstract class ShorelineFileDao {

	private static final org.slf4j.Logger LOGGER = LoggerFactory.getLogger(ShorelineFileDao.class);
	protected String JNDI_NAME;
	protected final String DEFAULT_JNDI_NAME = "dsas";
	public final static int DATABASE_PROJECTION = 4326;
	public final static String[] REQUIRED_FIELD_NAMES = new String[]{Constants.DB_DATE_ATTR, Constants.UNCY_ATTR, Constants.MHW_ATTR};

	protected Connection getConnection() {
		Connection con = null;
		try {
			Context initCtx = new InitialContext();
			Context envCtx = (Context) initCtx.lookup("java:comp/env");
			DataSource ds = (DataSource) envCtx.lookup(JNDI_NAME);
			con = ds.getConnection();
		} catch (SQLException | NamingException ex) {
			LOGGER.error("Could not create database connection", ex);
		}
		return con;
	}

	/**
	 *
	 * @param connection
	 * @param workspace
	 * @param date
	 * @param mhw
	 * @param source
	 * @param shorelineType
	 * @param auxillaryName
	 * @return
	 * @throws NamingException
	 * @throws SQLException
	 */
	protected long insertToShorelinesTable(Connection connection, String workspace, Date date, boolean mhw, String source, String shorelineType, String auxillaryName) throws NamingException, SQLException {
		String sql = "INSERT INTO shorelines "
				+ "(date, mhw, workspace, source, shoreline_type, auxillary_name) "
				+ "VALUES (?,?,?,?,?,?)";

		long createdId;

		try (PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
			ps.setDate(1, new java.sql.Date(date.getTime()));
			ps.setBoolean(2, mhw);
			ps.setString(3, workspace);
			ps.setString(4, source);
			ps.setString(5, shorelineType);
			ps.setString(6, auxillaryName);

			int affectedRows = ps.executeUpdate();
			if (affectedRows == 0) {
				throw new SQLException("Inserting a shoreline row failed. No rows affected");
			}

			try (ResultSet generatedKeys = ps.getGeneratedKeys()) {
				if (generatedKeys.next()) {
					createdId = generatedKeys.getLong(1);
				} else {
					throw new SQLException("Inserting a shoreline row failed. No ID obtained");
				}
			}
		}

		return createdId;
	}

	protected int insertPointIntoShorelinePointsTable(Connection connection, long shorelineId, int segmentId, double x, double y, double uncertainty) throws IOException, SchemaException, TransformException, NoSuchElementException, FactoryException, SQLException {
		StringBuilder sql = new StringBuilder("INSERT INTO shoreline_points (shoreline_id, segment_id, geom, uncy) ")
				.append("VALUES (")
				.append(shorelineId).append(",")
				.append(segmentId).append(",")
				.append("ST_GeomFromText('POINT(").append(x).append(" ").append(y).append(")',").append(DATABASE_PROJECTION).append("),")
				.append(uncertainty).append(")");

		try (Statement st = connection.createStatement()) {
			if (st.execute(sql.toString())) {
				return 1;
			} else {
				return 0;
			}
		}
	}

	/**
	 * Inserts an attribute into the auxillary table
	 * 
	 * @param connection
	 * @param shorelineId
	 * @param name
	 * @param value
	 * @return
	 * @throws SQLException besides the normal reasons, this may be thrown if the 
	 * element already exists in the table - for instance if the auxillary element
	 * was repeated earlier in the shoreline file
	 */
	protected int insertAuxillaryAttribute(Connection connection, long shorelineId, String name, String value) throws SQLException {
		String sql = "INSERT INTO shoreline_auxillary_attrs "
				+ "(shoreline_id, attr_name, value) "
				+ "VALUES (?,?,?)";

		try (PreparedStatement st = connection.prepareStatement(sql)) {
			st.setLong(1, shorelineId);
			st.setString(2, name);
			st.setString(3, value);
			return st.executeUpdate(sql);
		}
	}

	/**
	 * Sets up a view against a given workspace in the shorelines table
	 *
	 * @param connection
	 * @param workspace
	 * @return
	 * @throws SQLException
	 */
	protected String createViewAgainstWorkspace(Connection connection, String workspace) throws SQLException {
		String sql = "SELECT * FROM CREATE_WORKSPACE_VIEW(?)";

		try (PreparedStatement ps = connection.prepareStatement(sql)) {
			ps.setString(1, workspace);
			try (ResultSet rs = ps.executeQuery()) {
				if (rs.next()) {
					return rs.getString(1);
				}
				return null;
			}
		}
	}

	/**
	 * Imports the shoreline file into the database. Returns the name of the
	 * view that holds this shoreline
	 *
	 * @param shorelineFile File that will be used to import into the database
	 * @param columns mapping of file columns to database required columns
	 * @param workspace the unique name of workspace to create or append to
	 * @param EPSGCode the projection code for this shoreline file
	 * @return
	 * @throws
	 * gov.usgs.cida.coastalhazards.shoreline.exception.ShorelineFileFormatException
	 * @throws java.sql.SQLException
	 * @throws javax.naming.NamingException
	 * @throws java.text.ParseException
	 * @throws java.io.IOException
	 * @throws org.geotools.feature.SchemaException
	 * @throws org.opengis.referencing.FactoryException
	 * @throws org.opengis.referencing.operation.TransformException
	 */
	public abstract String importToDatabase(File shorelineFile, Map<String, String> columns, String workspace, String EPSGCode) throws ShorelineFileFormatException, SQLException, NamingException, NoSuchElementException, ParseException, IOException, SchemaException, TransformException, FactoryException;

}
