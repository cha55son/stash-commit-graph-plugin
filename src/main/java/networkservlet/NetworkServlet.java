package networkservlet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.*;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

public class NetworkServlet extends HttpServlet{
    private static final Logger log = LoggerFactory.getLogger(NetworkServlet.class);

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException
    {
        resp.setContentType("text/html");
        resp.getWriter().write("<html><body>Hello World</body></html>");

        // String userSlug = pathInfo.substring(1); // Strip leading slash
        // StashUser user = userService.getUserBySlug(userSlug);

        // if (user == null) {
        //     resp.sendError(HttpServletResponse.SC_NOT_FOUND);
        //     return;
        // }
    }

}
