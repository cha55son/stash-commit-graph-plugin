package networkservlet;

import com.atlassian.plugin.webresource.WebResourceManager;
import com.atlassian.soy.renderer.SoyException;
import com.atlassian.soy.renderer.SoyTemplateRenderer;

import com.atlassian.stash.content.Changeset;
import com.atlassian.stash.repository.Repository;
import com.atlassian.stash.repository.RepositoryService;
import com.atlassian.stash.commit.CommitService;
import com.atlassian.stash.commit.graph.*;
import com.google.common.collect.ImmutableMap;
import com.atlassian.stash.util.PageUtils;
import com.atlassian.stash.util.Page;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;

public class NetworkServlet extends HttpServlet {
    private static final Logger log = LoggerFactory.getLogger(NetworkServlet.class);

    private final RepositoryService repositoryService;
    private final SoyTemplateRenderer soyTemplateRenderer;
    private final WebResourceManager webResourceManager;
    private final CommitService commitService;

    public NetworkServlet(SoyTemplateRenderer soyTemplateRenderer,
                          RepositoryService repositoryService,
                          WebResourceManager webResourceManager,
                          CommitService commitService) {
        this.soyTemplateRenderer = soyTemplateRenderer;
        this.repositoryService = repositoryService;
        this.webResourceManager = webResourceManager;
        this.commitService = commitService;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Get repoSlug from path
        String pathInfo = req.getPathInfo();

        String[] components = pathInfo.split("/");

        if (components.length < 3) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        final Repository repository = repositoryService.getBySlug(components[1], components[2]);

        if (repository == null) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        final ArrayList<Changeset> changesets = new ArrayList<Changeset>();
        TraversalRequest request = new TraversalRequest.Builder().repository(repository).build();

        commitService.traverse(request, new TraversalCallback() {
            @Override
            public TraversalStatus onNode(CommitGraphNode node) {
                changesets.add(commitService.getChangeset(repository, node.getCommit().getId()));
                return TraversalStatus.CONTINUE;
            }
        });

        // Convert the arraylist to a page
        Page<Changeset> changesetPage = PageUtils.createPage(changesets, PageUtils.newRequest(0, changesets.size()));

        webResourceManager.requireResource("com.plugin.commitgraph.commitgraph:commitgraph-resources");
        render(resp, "plugin.network.network", ImmutableMap.<String, Object>of(
            "repository", repository,
            "changesetPage", changesetPage
        ));
    }

    protected void render(HttpServletResponse resp, String templateName, Map<String, Object> data) throws IOException, ServletException {
        resp.setContentType("text/html;charset=UTF-8");
        try {
            soyTemplateRenderer.render(
                resp.getWriter(),
                "com.plugin.commitgraph.commitgraph:network-soy",
                templateName,
                data
            );
        } catch (SoyException e) {
            Throwable cause = e.getCause();
            if (cause instanceof IOException) {
                throw (IOException) cause;
            }
            throw new ServletException(e);
        }
    }
}
