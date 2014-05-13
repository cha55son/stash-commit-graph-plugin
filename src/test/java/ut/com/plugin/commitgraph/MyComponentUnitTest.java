package ut.com.plugin.commitgraph;

import org.junit.Test;
import com.plugin.commitgraph.MyPluginComponent;
import com.plugin.commitgraph.MyPluginComponentImpl;

import static org.junit.Assert.assertEquals;

public class MyComponentUnitTest
{
    @Test
    public void testMyName()
    {
        MyPluginComponent component = new MyPluginComponentImpl(null);
        assertEquals("names do not match!", "myComponent",component.getName());
    }
}
